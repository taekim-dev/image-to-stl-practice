import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader';

class ImageToSTLConverter {
    private scene: THREE.Scene;
    private camera: THREE.PerspectiveCamera;
    private renderer: THREE.WebGLRenderer;
    private controls: OrbitControls;
    private imageInput: HTMLInputElement;
    private previewContainer: HTMLDivElement;
    private downloadButton: HTMLButtonElement;
    private worker: Worker;
    private currentSTL: string | null = null;

    constructor() {
        // Initialize Three.js components
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
        this.previewContainer = document.getElementById('preview-container') as HTMLDivElement;
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(this.previewContainer.clientWidth, this.previewContainer.clientHeight);
        this.previewContainer.appendChild(this.renderer.domElement);

        // Set up camera and controls
        this.camera.position.z = 5;
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;

        // Add lighting
        const ambientLight = new THREE.AmbientLight(0x404040);
        const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
        directionalLight.position.set(1, 1, 1);
        this.scene.add(ambientLight, directionalLight);

        // Initialize UI elements
        this.imageInput = document.getElementById('image-input') as HTMLInputElement;
        this.downloadButton = document.getElementById('download-btn') as HTMLButtonElement;

        // Initialize Web Worker
        this.worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });

        // Set up event listeners
        this.setupEventListeners();
        
        // Start animation loop
        this.animate();
    }

    private setupEventListeners() {
        // Handle image upload
        this.imageInput.addEventListener('change', this.handleImageUpload.bind(this));

        // Handle window resize
        window.addEventListener('resize', this.handleResize.bind(this));

        // Handle worker messages
        this.worker.onmessage = this.handleWorkerMessage.bind(this);

        // Handle download button
        this.downloadButton.addEventListener('click', this.handleDownload.bind(this));
    }

    private async handleImageUpload(event: Event) {
        const file = (event.target as HTMLInputElement).files?.[0];
        if (!file) return;

        // Validate file size (max 2MB)
        if (file.size > 2 * 1024 * 1024) {
            alert('File size must be less than 2MB');
            return;
        }

        // Validate file type
        if (!['image/png', 'image/jpeg'].includes(file.type)) {
            alert('Only PNG and JPEG files are supported');
            return;
        }

        try {
            // Show image preview
            const imagePreview = document.getElementById('image-preview');
            if (imagePreview) {
                const img = document.createElement('img');
                img.style.maxWidth = '100%';
                img.style.height = 'auto';
                img.style.marginTop = '10px';
                img.src = URL.createObjectURL(file);
                imagePreview.innerHTML = '';
                imagePreview.appendChild(img);
            }

            // Read the file and send to worker
            const arrayBuffer = await file.arrayBuffer();
            this.worker.postMessage({ type: 'processImage', data: arrayBuffer });
        } catch (error) {
            console.error('Error processing image:', error);
            alert('Error processing image');
        }
    }

    private handleWorkerMessage(event: MessageEvent) {
        const { type, data } = event.data;

        if (type === 'stlGenerated') {
            // Store the STL data for download
            this.currentSTL = data;

            // Load the STL data into the scene
            const loader = new STLLoader();
            const geometry = loader.parse(data);
            const material = new THREE.MeshPhongMaterial({ 
                color: 0x00ff00,
                flatShading: true
            });
            const mesh = new THREE.Mesh(geometry, material);

            // Clear existing mesh
            this.scene.clear();
            this.scene.add(mesh);

            // Center the camera on the mesh
            const box = new THREE.Box3().setFromObject(mesh);
            const center = box.getCenter(new THREE.Vector3());
            const size = box.getSize(new THREE.Vector3());
            const maxDim = Math.max(size.x, size.y, size.z);
            this.camera.position.copy(center);
            this.camera.position.z += maxDim * 2;
            this.controls.target.copy(center);

            // Enable download button
            this.downloadButton.disabled = false;
        }
    }

    private handleResize() {
        const width = this.previewContainer.clientWidth;
        const height = this.previewContainer.clientHeight;
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
    }

    private handleDownload() {
        const stlString = this.currentSTL;
        if (!stlString) return;

        const blob = new Blob([stlString], { type: 'application/sla' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'model.stl';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    private animate() {
        requestAnimationFrame(this.animate.bind(this));
        this.controls.update();
        this.renderer.render(this.scene, this.camera);
    }
}

// Initialize the application
new ImageToSTLConverter(); 