/**
 * Utility to add a watermark to an image file.
 * Adds order number, date, time, and GPS coordinates to the bottom corner.
 */
export async function addWatermarkToImage(
    file: File,
    data: {
        orderNumber: string;
        date: string;
        time: string;
        gps?: { lat: number; lng: number };
    }
): Promise<Blob> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.src = URL.createObjectURL(file);
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                reject(new Error('Could not get canvas context'));
                return;
            }

            // Set canvas size to image size
            canvas.width = img.width;
            canvas.height = img.height;

            // Draw original image
            ctx.drawImage(img, 0, 0);

            // Setup text style
            const fontSize = Math.max(20, Math.floor(img.width / 40));
            ctx.font = `bold ${fontSize}px monospace`;
            ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
            ctx.lineWidth = Math.max(1, fontSize / 10);

            // Prepare text lines
            const lines = [
                `OS: ${data.orderNumber}`,
                `DATA: ${data.date} ${data.time}`,
            ];

            if (data.gps) {
                lines.push(`GPS: ${data.gps.lat.toFixed(6)}, ${data.gps.lng.toFixed(6)}`);
            }

            // Draw text from bottom-right
            const padding = fontSize;
            let currentY = canvas.height - padding;

            [...lines].reverse().forEach((line) => {
                const textWidth = ctx.measureText(line).width;
                const x = canvas.width - textWidth - padding;

                ctx.strokeText(line, x, currentY);
                ctx.fillText(line, x, currentY);
                currentY -= fontSize * 1.2;
            });

            // Convert back to Blob
            canvas.toBlob(
                (blob) => {
                    if (blob) {
                        resolve(blob);
                    } else {
                        reject(new Error('Canvas toBlob failed'));
                    }
                },
                'image/jpeg',
                0.85
            );

            URL.revokeObjectURL(img.src);
        };
        img.onerror = reject;
    });
}
