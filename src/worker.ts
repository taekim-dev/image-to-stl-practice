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

async function detectEdges(imageData: ArrayBuffer): Promise<boolean[][]> {
    try {
        const blob: Blob = new Blob([imageData], { type: 'image/jpeg' });
        const bitmap: ImageBitmap = await createImageBitmap(blob, {
            imageOrientation: 'flipY',  // Ensure correct orientation
            premultiplyAlpha: 'none',
            colorSpaceConversion: 'none'
        });
        
        // Scale image to manageable size if too large
        const maxSize = 512;
        const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
        const width = Math.round(bitmap.width * scale);
        const height = Math.round(bitmap.height * scale);
        
        const canvas: OffscreenCanvas = new OffscreenCanvas(width, height);
        const ctx: OffscreenCanvasRenderingContext2D | null = canvas.getContext('2d', {
            willReadFrequently: true
        });
        
        if (!ctx) {
            throw new Error('Could not get canvas context');
        }

        // Clear canvas and set to white background
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, width, height);
        
        // Set image smoothing to false for sharper edges
        ctx.imageSmoothingEnabled = false;
        
        // Draw the image in black
        ctx.globalCompositeOperation = 'source-over';
        ctx.drawImage(bitmap, 0, 0, width, height);
        
        const pixelData = ctx.getImageData(0, 0, width, height);
        const data = pixelData.data;

        // Convert to binary (black/white) array with more aggressive thresholding
        const edges: boolean[][] = [];
        const threshold = 128; // Middle threshold for binary image

        // First pass: basic edge detection
        for (let y = 0; y < height; y++) {
            edges[y] = [];
            for (let x = 0; x < width; x++) {
                const i = (y * width + x) * 4;
                // Check if pixel is black (accounting for alpha)
                const isBlack = data[i] < threshold && data[i + 3] > 200;
                edges[y][x] = isBlack;
            }
        }

        // Second pass: find outline
        const outline: boolean[][] = Array(height).fill(0).map(() => Array(width).fill(false));
        
        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                if (edges[y][x]) {
                    // Check if this pixel is on the edge of the shape
                    let isEdge = false;
                    for (let dy = -1; dy <= 1; dy++) {
                        for (let dx = -1; dx <= 1; dx++) {
                            if (!edges[y + dy][x + dx]) {
                                isEdge = true;
                                break;
                            }
                        }
                        if (isEdge) break;
                    }
                    outline[y][x] = isEdge;
                }
            }
        }

        // Debug: log dimensions and some sample values
        console.log('Image dimensions:', width, height);
        console.log('Sample outline values:', outline[Math.floor(height/2)].slice(0, 10));

        return outline;
    } catch (error) {
        console.error('Error in detectEdges:', error);
        throw error;
    }
}

function generateCookieCutterSTL(edges: boolean[][]): string {
    const triangles: Triangle[] = [];
    const height = edges.length;
    const width = edges[0].length;
    
    // Configuration for traditional cookie cutter profile
    const scale = 60; // Overall size in mm
    const wallHeight = 15; // Total height of the cutter in mm
    const topWidth = 4.0; // Width at the top for handling (4mm)
    const bottomWidth = 0.5; // Width at the cutting edge (0.5mm)
    const baseHeight = 0.8; // Height of the base in mm
    const numLayers = 8; // Number of layers for the wall profile
    
    // Helper function to add a quad (two triangles)
    function addQuad(v1: Vertex, v2: Vertex, v3: Vertex, v4: Vertex) {
        const normal1 = calculateNormal(v1, v2, v3);
        const normal2 = calculateNormal(v1, v3, v4);
        
        triangles.push({
            normal: normal1,
            vertices: [v1, v2, v3]
        });
        triangles.push({
            normal: normal2,
            vertices: [v1, v3, v4]
        });
    }

    // Create walls where edges are detected
    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            if (edges[y][x]) {
                // Calculate normalized positions
                const xPos = (x / width - 0.5) * scale;
                const yPos = (y / height - 0.5) * scale;
                
                // Check all 8 directions for wall creation
                const directions = [
                    [-1, 0], [1, 0], [0, -1], [0, 1],
                    [-1, -1], [1, -1], [-1, 1], [1, 1]
                ];
                
                for (const [dx, dy] of directions) {
                    const nx = x + dx;
                    const ny = y + dy;
                    
                    // Only create wall if we're at the edge
                    if (nx >= 0 && nx < width && ny >= 0 && ny < height && !edges[ny][nx]) {
                        // Calculate normalized direction
                        const len = Math.sqrt(dx * dx + dy * dy);
                        const ndx = dx / len;
                        const ndy = dy / len;

                        // Create vertices for each layer of the wall
                        for (let i = 0; i < numLayers - 1; i++) {
                            const z1 = baseHeight + (wallHeight * i) / (numLayers - 1);
                            const z2 = baseHeight + (wallHeight * (i + 1)) / (numLayers - 1);
                            
                            // Calculate width for current and next layer
                            const width1 = topWidth - (i * (topWidth - bottomWidth)) / (numLayers - 1);
                            const width2 = topWidth - ((i + 1) * (topWidth - bottomWidth)) / (numLayers - 1);
                            
                            // Create vertices for this segment
                            const v1: Vertex = {
                                x: xPos + ndx * width1,
                                y: yPos + ndy * width1,
                                z: z1
                            };
                            const v2: Vertex = {
                                x: xPos,
                                y: yPos,
                                z: z1
                            };
                            const v3: Vertex = {
                                x: xPos,
                                y: yPos,
                                z: z2
                            };
                            const v4: Vertex = {
                                x: xPos + ndx * width2,
                                y: yPos + ndy * width2,
                                z: z2
                            };
                            
                            addQuad(v1, v2, v3, v4);
                            
                            // Add top face for the last layer
                            if (i === numLayers - 2) {
                                const v5: Vertex = {
                                    x: xPos + ndx * width2,
                                    y: yPos + ndy * width2,
                                    z: z2
                                };
                                const v6: Vertex = {
                                    x: xPos,
                                    y: yPos,
                                    z: z2
                                };
                                addQuad(v5, v6, v6, v5); // Create a small top face
                            }
                        }
                    }
                }
            }
        }
    }

    // Add base with margin
    const margin = topWidth * 1.5; // Wider margin for stability
    const baseVertices: Vertex[] = [
        { x: -scale/2 - margin, y: -scale/2 - margin, z: 0 },
        { x: scale/2 + margin, y: -scale/2 - margin, z: 0 },
        { x: scale/2 + margin, y: scale/2 + margin, z: 0 },
        { x: -scale/2 - margin, y: scale/2 + margin, z: 0 },
        { x: -scale/2 - margin, y: -scale/2 - margin, z: baseHeight },
        { x: scale/2 + margin, y: -scale/2 - margin, z: baseHeight },
        { x: scale/2 + margin, y: scale/2 + margin, z: baseHeight },
        { x: -scale/2 - margin, y: scale/2 + margin, z: baseHeight }
    ];

    // Add base faces
    addQuad(baseVertices[0], baseVertices[1], baseVertices[2], baseVertices[3]); // Bottom
    addQuad(baseVertices[4], baseVertices[7], baseVertices[6], baseVertices[5]); // Top
    addQuad(baseVertices[0], baseVertices[4], baseVertices[5], baseVertices[1]); // Front
    addQuad(baseVertices[1], baseVertices[5], baseVertices[6], baseVertices[2]); // Right
    addQuad(baseVertices[2], baseVertices[6], baseVertices[7], baseVertices[3]); // Back
    addQuad(baseVertices[3], baseVertices[7], baseVertices[4], baseVertices[0]); // Left

    // Generate STL string
    let stl = 'solid cookieCutter\n';
    
    for (const triangle of triangles) {
        stl += `facet normal ${triangle.normal.x} ${triangle.normal.y} ${triangle.normal.z}\n`;
        stl += '    outer loop\n';
        for (const vertex of triangle.vertices) {
            stl += `        vertex ${vertex.x} ${vertex.y} ${vertex.z}\n`;
        }
        stl += '    endloop\n';
        stl += 'endfacet\n';
    }
    
    stl += 'endsolid cookieCutter';
    return stl;
}

self.onmessage = async (event: MessageEvent) => {
    const { type, data } = event.data;

    if (type === 'processImage') {
        try {
            const edges = await detectEdges(data);
            const stlData = generateCookieCutterSTL(edges);
            self.postMessage({ type: 'stlGenerated', data: stlData });
        } catch (error) {
            console.error('Error processing image:', error);
            self.postMessage({ type: 'error', message: 'Failed to process image' });
        }
    }
}; 