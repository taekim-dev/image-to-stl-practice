// For MVP, we'll create a simple cube STL as placeholder
// Later this will be replaced with actual image processing logic

interface Vertex {
    x: number;
    y: number;
    z: number;
}

interface Triangle {
    normal: Vertex;
    vertices: [Vertex, Vertex, Vertex];
}

function normalizeValue(value: number, min: number, max: number): number {
    return (value - min) / (max - min);
}

function calculateNormal(v1: Vertex, v2: Vertex, v3: Vertex): Vertex {
    const u = {
        x: v2.x - v1.x,
        y: v2.y - v1.y,
        z: v2.z - v1.z
    };
    const v = {
        x: v3.x - v1.x,
        y: v3.y - v1.y,
        z: v3.z - v1.z
    };
    
    return {
        x: u.y * v.z - u.z * v.y,
        y: u.z * v.x - u.x * v.z,
        z: u.x * v.y - u.y * v.x
    };
}

async function imageDataToHeightMap(imageData: ArrayBuffer): Promise<number[][]> {
    try {
        // Create a blob from the array buffer
        const blob = new Blob([imageData], { type: 'image/jpeg' });
        
        // Create ImageBitmap from blob
        const bitmap = await createImageBitmap(blob);
        
        // Create canvas and get pixel data
        const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
        const ctx = canvas.getContext('2d')!;
        
        // Draw the image and get its data
        ctx.drawImage(bitmap, 0, 0);
        const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;

        // Convert to grayscale height map
        const heightMap: number[][] = [];
        let min = 255, max = 0;

        for (let y = 0; y < canvas.height; y++) {
            heightMap[y] = [];
            for (let x = 0; x < canvas.width; x++) {
                const i = (y * canvas.width + x) * 4;
                // Convert RGB to grayscale using luminosity method
                const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
                heightMap[y][x] = gray;
                min = Math.min(min, gray);
                max = Math.max(max, gray);
            }
        }

        // Normalize height values
        for (let y = 0; y < canvas.height; y++) {
            for (let x = 0; x < canvas.width; x++) {
                heightMap[y][x] = normalizeValue(heightMap[y][x], min, max);
            }
        }

        return heightMap;
    } catch (error) {
        console.error('Error in imageDataToHeightMap:', error);
        throw error;
    }
}

function generateSTL(heightMap: number[][]): string {
    const triangles: Triangle[] = [];
    const height = heightMap.length;
    const width = heightMap[0].length;
    const scale = 50; // Scale factor for the final model
    const baseThickness = 2; // Base thickness for the model

    // Generate top surface triangles
    for (let y = 0; y < height - 1; y++) {
        for (let x = 0; x < width - 1; x++) {
            const x1 = (x / width - 0.5) * scale;
            const x2 = ((x + 1) / width - 0.5) * scale;
            const y1 = (y / height - 0.5) * scale;
            const y2 = ((y + 1) / height - 0.5) * scale;

            const z11 = heightMap[y][x] * scale;
            const z21 = heightMap[y][x + 1] * scale;
            const z12 = heightMap[y + 1][x] * scale;
            const z22 = heightMap[y + 1][x + 1] * scale;

            // First triangle
            const v1: Vertex = { x: x1, y: y1, z: z11 };
            const v2: Vertex = { x: x2, y: y1, z: z21 };
            const v3: Vertex = { x: x1, y: y2, z: z12 };
            const normal1 = calculateNormal(v1, v2, v3);

            triangles.push({
                normal: normal1,
                vertices: [v1, v2, v3]
            });

            // Second triangle
            const v4: Vertex = { x: x2, y: y1, z: z21 };
            const v5: Vertex = { x: x2, y: y2, z: z22 };
            const v6: Vertex = { x: x1, y: y2, z: z12 };
            const normal2 = calculateNormal(v4, v5, v6);

            triangles.push({
                normal: normal2,
                vertices: [v4, v5, v6]
            });
        }
    }

    // Generate base
    const baseVertices: Vertex[] = [
        { x: -scale/2, y: -scale/2, z: -baseThickness },
        { x: scale/2, y: -scale/2, z: -baseThickness },
        { x: scale/2, y: scale/2, z: -baseThickness },
        { x: -scale/2, y: scale/2, z: -baseThickness }
    ];

    // Add base triangles
    triangles.push({
        normal: { x: 0, y: 0, z: -1 },
        vertices: [baseVertices[0], baseVertices[1], baseVertices[2]]
    });
    triangles.push({
        normal: { x: 0, y: 0, z: -1 },
        vertices: [baseVertices[0], baseVertices[2], baseVertices[3]]
    });

    // Generate STL string
    let stl = 'solid imageMesh\n';
    
    for (const triangle of triangles) {
        stl += `facet normal ${triangle.normal.x} ${triangle.normal.y} ${triangle.normal.z}\n`;
        stl += '    outer loop\n';
        for (const vertex of triangle.vertices) {
            stl += `        vertex ${vertex.x} ${vertex.y} ${vertex.z}\n`;
        }
        stl += '    endloop\n';
        stl += 'endfacet\n';
    }
    
    stl += 'endsolid imageMesh';
    return stl;
}

self.onmessage = async (event: MessageEvent) => {
    const { type, data } = event.data;

    if (type === 'processImage') {
        try {
            const heightMap = await imageDataToHeightMap(data);
            const stlData = generateSTL(heightMap);
            self.postMessage({ type: 'stlGenerated', data: stlData });
        } catch (error) {
            console.error('Error processing image:', error);
            self.postMessage({ type: 'error', message: 'Failed to process image' });
        }
    }
}; 