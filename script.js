class ImageItem {
    id;
    name;
    src;
    originalImage;
    processedImage;
    maskCanvas;
    selected;
    processed;

    constructor(id, name, src, image) {
        this.id = id;
        this.name = name;
        this.src = src;
        this.originalImage = image;
        this.processedImage = null;
        this.maskCanvas = null;
        this.selected = false;
        this.processed = false;
    }

    getCurrentImage() {
        return this.processedImage || this.originalImage;
    }

    createMask(width, height) {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        this.maskCanvas = canvas;
        return canvas;
    }

    hasMask() {
        return this.maskCanvas && this.getMaskPixels().length > 0;
    }

    getMaskPixels() {
        if (!this.maskCanvas) return [];
        const ctx = this.maskCanvas.getContext('2d');
        const imageData = ctx.getImageData(0, 0, this.maskCanvas.width, this.maskCanvas.height);
        const pixels = [];
        for (let i = 0; i < imageData.data.length; i += 4) {
            if (imageData.data[i + 3] > 0) {
                const index = i / 4;
                pixels.push({
                    x: index % this.maskCanvas.width,
                    y: Math.floor(index / this.maskCanvas.width)
                });
            }
        }
        return pixels;
    }

    clearMask() {
        if (this.maskCanvas) {
            const ctx = this.maskCanvas.getContext('2d');
            ctx.clearRect(0, 0, this.maskCanvas.width, this.maskCanvas.height);
        }
    }

    reset() {
        this.processedImage = null;
        this.processed = false;
        this.clearMask();
    }
}

class WatermarkRemover {
    images = [];
    selectedImageId = null;
    brushSize = 20;
    zoom = 1;
    isDrawing = false;
    lastPos = null;

    canvas = null;
    ctx = null;
    maskCtx = null;

    brushSizeInput = null;
    brushSizeValue = null;
    brushPreview = null;
    canvasOverlay = null;
    fileInput = null;
    imageList = null;
    imageCount = null;
    canvasStatus = null;
    zoomValue = null;
    loadingOverlay = null;

    removeWatermarkBtn = null;
    clearSelectionBtn = null;
    resetImageBtn = null;
    downloadAllBtn = null;

    constructor() {
        this.initElements();
        this.initEventListeners();
        this.updateBrushPreview();
    }

    initElements() {
        this.canvas = document.getElementById('mainCanvas');
        this.ctx = this.canvas.getContext('2d');

        this.brushSizeInput = document.getElementById('brushSize');
        this.brushSizeValue = document.getElementById('brushSizeValue');
        this.brushPreview = document.getElementById('brushPreview');
        this.canvasOverlay = document.getElementById('canvasOverlay');
        this.fileInput = document.getElementById('fileInput');
        this.imageList = document.getElementById('imageList');
        this.imageCount = document.getElementById('imageCount');
        this.canvasStatus = document.getElementById('canvasStatus');
        this.zoomValue = document.getElementById('zoomValue');
        this.loadingOverlay = document.getElementById('loadingOverlay');

        this.removeWatermarkBtn = document.getElementById('removeWatermarkBtn');
        this.clearSelectionBtn = document.getElementById('clearSelectionBtn');
        this.resetImageBtn = document.getElementById('resetImageBtn');
        this.downloadAllBtn = document.getElementById('downloadAllBtn');
    }

    initEventListeners() {
        this.brushSizeInput.addEventListener('input', (e) => {
            this.brushSize = parseInt(e.target.value);
            this.brushSizeValue.textContent = `${this.brushSize}px`;
            this.updateBrushPreview();
        });

        this.canvasOverlay.addEventListener('click', () => {
            this.fileInput.click();
        });

        this.canvasOverlay.addEventListener('dragover', (e) => {
            e.preventDefault();
            this.canvasOverlay.style.background = 'rgba(0, 212, 255, 0.2)';
        });

        this.canvasOverlay.addEventListener('dragleave', () => {
            this.canvasOverlay.style.background = 'rgba(17, 24, 39, 0.5)';
        });

        this.canvasOverlay.addEventListener('drop', (e) => {
            e.preventDefault();
            this.canvasOverlay.style.background = 'rgba(17, 24, 39, 0.5)';
            const files = Array.from(e.dataTransfer.files);
            this.handleFiles(files);
        });

        this.fileInput.addEventListener('change', (e) => {
            const files = Array.from(e.target.files);
            this.handleFiles(files);
            e.target.value = '';
        });

        this.canvas.addEventListener('mousedown', this.startDrawing.bind(this));
        this.canvas.addEventListener('mousemove', this.draw.bind(this));
        this.canvas.addEventListener('mouseup', this.stopDrawing.bind(this));
        this.canvas.addEventListener('mouseleave', this.stopDrawing.bind(this));

        this.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.startDrawing(e.touches[0]);
        });
        this.canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            this.draw(e.touches[0]);
        });
        this.canvas.addEventListener('touchend', (e) => {
            e.preventDefault();
            this.stopDrawing();
        });

        document.getElementById('zoomIn').addEventListener('click', () => {
            this.zoom = Math.min(this.zoom + 0.25, 3);
            this.updateZoom();
        });

        document.getElementById('zoomOut').addEventListener('click', () => {
            this.zoom = Math.max(this.zoom - 0.25, 0.25);
            this.updateZoom();
        });

        this.removeWatermarkBtn.addEventListener('click', this.removeWatermark.bind(this));
        this.clearSelectionBtn.addEventListener('click', this.clearSelection.bind(this));
        this.resetImageBtn.addEventListener('click', this.resetImage.bind(this));
        this.downloadAllBtn.addEventListener('click', this.downloadAll.bind(this));
    }

    updateBrushPreview() {
        const size = this.brushSize;
        this.brushPreview.style.width = `${size * 4}px`;
        this.brushPreview.style.height = `${size * 4}px`;
    }

    handleFiles(files) {
        const imageFiles = files.filter(file => file.type.startsWith('image/'));
        
        imageFiles.forEach(file => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    const id = Date.now() + Math.random().toString(36).substr(2, 9);
                    const imageItem = new ImageItem(id, file.name, e.target.result, img);
                    this.images.push(imageItem);
                    this.renderImageList();
                    
                    if (this.images.length === 1) {
                        this.selectImage(id);
                    }
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
        });

        this.canvasOverlay.style.display = this.images.length > 0 ? 'none' : 'flex';
    }

    selectImage(id) {
        this.selectedImageId = id;
        this.images.forEach(img => img.selected = img.id === id);
        
        const imageItem = this.images.find(img => img.id === id);
        if (imageItem) {
            this.loadImageToCanvas(imageItem);
            this.canvasStatus.textContent = imageItem.name;
            this.canvasOverlay.style.display = 'none';
        }
        
        this.renderImageList();
        this.updateButtonStates();
    }

    loadImageToCanvas(imageItem) {
        const img = imageItem.getCurrentImage();
        this.canvas.width = img.width;
        this.canvas.height = img.height;
        
        if (!imageItem.maskCanvas) {
            imageItem.createMask(img.width, img.height);
        }
        
        this.maskCtx = imageItem.maskCanvas.getContext('2d');
        
        this.redrawCanvas(imageItem);
        this.updateZoom();
    }

    redrawCanvas(imageItem) {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.drawImage(imageItem.getCurrentImage(), 0, 0);
        
        if (imageItem.maskCanvas) {
            this.ctx.globalAlpha = 0.4;
            this.ctx.fillStyle = '#00d4ff';
            this.ctx.drawImage(imageItem.maskCanvas, 0, 0);
            this.ctx.globalAlpha = 1;
        }
    }

    updateZoom() {
        this.canvas.style.transform = `scale(${this.zoom})`;
        this.zoomValue.textContent = `${Math.round(this.zoom * 100)}%`;
    }

    getCanvasCoordinates(e) {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        
        return {
            x: (e.clientX - rect.left) * scaleX / this.zoom,
            y: (e.clientY - rect.top) * scaleY / this.zoom
        };
    }

    startDrawing(e) {
        if (!this.selectedImageId) return;
        
        const imageItem = this.images.find(img => img.id === this.selectedImageId);
        if (!imageItem) return;
        
        this.isDrawing = true;
        const pos = this.getCanvasCoordinates(e);
        this.lastPos = pos;
        
        this.drawBrush(pos, imageItem);
    }

    draw(e) {
        if (!this.isDrawing || !this.selectedImageId) return;
        
        const imageItem = this.images.find(img => img.id === this.selectedImageId);
        if (!imageItem) return;
        
        const pos = this.getCanvasCoordinates(e);
        
        if (this.lastPos) {
            this.drawLine(this.lastPos, pos, imageItem);
        }
        
        this.lastPos = pos;
    }

    stopDrawing() {
        this.isDrawing = false;
        this.lastPos = null;
        this.updateButtonStates();
    }

    drawBrush(pos, imageItem) {
        if (!this.maskCtx) return;
        
        this.maskCtx.beginPath();
        this.maskCtx.arc(pos.x, pos.y, this.brushSize / 2, 0, Math.PI * 2);
        this.maskCtx.fillStyle = 'rgba(0, 212, 255, 1)';
        this.maskCtx.fill();
        
        this.redrawCanvas(imageItem);
    }

    drawLine(start, end, imageItem) {
        if (!this.maskCtx) return;
        
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const steps = Math.ceil(distance);
        
        for (let i = 0; i <= steps; i++) {
            const x = start.x + (dx * i) / steps;
            const y = start.y + (dy * i) / steps;
            
            this.maskCtx.beginPath();
            this.maskCtx.arc(x, y, this.brushSize / 2, 0, Math.PI * 2);
            this.maskCtx.fillStyle = 'rgba(0, 212, 255, 1)';
            this.maskCtx.fill();
        }
        
        this.redrawCanvas(imageItem);
    }

    removeWatermark() {
        if (!this.selectedImageId) return;
        
        const imageItem = this.images.find(img => img.id === this.selectedImageId);
        if (!imageItem || !imageItem.hasMask()) return;
        
        this.showLoading(true);
        
        setTimeout(() => {
            try {
                const result = this.processImage(imageItem);
                imageItem.processedImage = result;
                imageItem.processed = true;
                imageItem.clearMask();
                
                if (result.complete) {
                    this.redrawCanvas(imageItem);
                    this.renderImageList();
                    this.updateButtonStates();
                    this.showLoading(false);
                } else {
                    result.onload = () => {
                        this.redrawCanvas(imageItem);
                        this.renderImageList();
                        this.updateButtonStates();
                        this.showLoading(false);
                    };
                    result.onerror = () => {
                        this.showLoading(false);
                        alert('图片加载失败，请重试');
                    };
                }
            } catch (error) {
                console.error('处理失败:', error);
                alert('处理失败，请重试');
                this.showLoading(false);
            }
        }, 100);
    }

    processImage(imageItem) {
        const img = imageItem.originalImage;
        const width = img.width;
        const height = img.height;
        
        const outputCanvas = document.createElement('canvas');
        outputCanvas.width = width;
        outputCanvas.height = height;
        const outputCtx = outputCanvas.getContext('2d');
        outputCtx.drawImage(img, 0, 0);
        
        const imageData = outputCtx.getImageData(0, 0, width, height);
        const data = imageData.data;
        
        const mask = this.createMaskArray(imageItem.maskCanvas, width, height);
        
        const sampleRadius = Math.max(this.brushSize * 2, 30);
        const edgeRadius = Math.max(this.brushSize, 15);
        
        this.fillMaskedArea(data, mask, width, height, sampleRadius);
        
        this.smoothEdges(data, mask, width, height, edgeRadius);
        
        outputCtx.putImageData(imageData, 0, 0);
        
        const resultImg = new Image();
        resultImg.src = outputCanvas.toDataURL('image/png');
        resultImg.width = width;
        resultImg.height = height;
        
        return resultImg;
    }

    createMaskArray(maskCanvas, width, height) {
        if (!maskCanvas) return new Uint8Array(width * height);
        
        const ctx = maskCanvas.getContext('2d');
        const maskData = ctx.getImageData(0, 0, width, height);
        const mask = new Uint8Array(width * height);
        
        for (let i = 0; i < maskData.data.length; i += 4) {
            if (maskData.data[i + 3] > 0) {
                const index = i / 4;
                mask[index] = 1;
            }
        }
        
        return mask;
    }

    fillMaskedArea(data, mask, width, height, sampleRadius) {
        const maskPixels = [];
        
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                if (mask[y * width + x]) {
                    maskPixels.push({ x, y });
                }
            }
        }
        
        maskPixels.sort((a, b) => {
            return b.x + b.y - (a.x + a.y);
        });
        
        for (const pixel of maskPixels) {
            const x = pixel.x;
            const y = pixel.y;
            const index = (y * width + x) * 4;
            
            let totalR = 0, totalG = 0, totalB = 0;
            let totalWeight = 0;
            
            const actualRadius = Math.min(sampleRadius, x, width - 1 - x, y, height - 1 - y);
            
            for (let dy = -actualRadius; dy <= actualRadius; dy++) {
                for (let dx = -actualRadius; dx <= actualRadius; dx++) {
                    const nx = x + dx;
                    const ny = y + dy;
                    
                    if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                        const ni = (ny * width + nx) * 4;
                        
                        if (!mask[ny * width + nx]) {
                            const dist = Math.sqrt(dx * dx + dy * dy);
                            
                            if (dist < actualRadius) {
                                const distWeight = 1 - (dist / actualRadius);
                                const gradientWeight = this.calculateGradientWeight(data, nx, ny, width);
                                const weight = distWeight * distWeight * gradientWeight;
                                
                                totalR += data[ni] * weight;
                                totalG += data[ni + 1] * weight;
                                totalB += data[ni + 2] * weight;
                                totalWeight += weight;
                            }
                        }
                    }
                }
            }
            
            if (totalWeight > 0) {
                data[index] = Math.round(totalR / totalWeight);
                data[index + 1] = Math.round(totalG / totalWeight);
                data[index + 2] = Math.round(totalB / totalWeight);
            }
        }
    }

    calculateGradientWeight(data, x, y, width) {
        const centerIndex = (y * width + x) * 4;
        
        let sumDiff = 0;
        let count = 0;
        
        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                if (dx === 0 && dy === 0) continue;
                
                const nx = x + dx;
                const ny = y + dy;
                
                if (nx >= 0 && nx < width && ny >= 0 && ny < (data.length / 4 / width)) {
                    const ni = (ny * width + nx) * 4;
                    
                    const diffR = Math.abs(data[ni] - data[centerIndex]);
                    const diffG = Math.abs(data[ni + 1] - data[centerIndex + 1]);
                    const diffB = Math.abs(data[ni + 2] - data[centerIndex + 2]);
                    
                    sumDiff += (diffR + diffG + diffB) / 3;
                    count++;
                }
            }
        }
        
        const avgDiff = sumDiff / (count || 1);
        return Math.max(0.1, 1 - avgDiff / 100);
    }

    smoothEdges(data, mask, width, height, edgeRadius) {
        const tempData = new Uint8ClampedArray(data);
        
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const index = (y * width + x) * 4;
                
                if (mask[y * width + x]) {
                    let hasEdge = false;
                    
                    for (let dy = -1; dy <= 1; dy++) {
                        for (let dx = -1; dx <= 1; dx++) {
                            const nx = x + dx;
                            const ny = y + dy;
                            
                            if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                                if (!mask[ny * width + nx]) {
                                    hasEdge = true;
                                    break;
                                }
                            }
                        }
                        if (hasEdge) break;
                    }
                    
                    if (hasEdge) {
                        let totalR = tempData[index];
                        let totalG = tempData[index + 1];
                        let totalB = tempData[index + 2];
                        let count = 1;
                        
                        for (let dy = -1; dy <= 1; dy++) {
                            for (let dx = -1; dx <= 1; dx++) {
                                if (dx === 0 && dy === 0) continue;
                                
                                const nx = x + dx;
                                const ny = y + dy;
                                
                                if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                                    const ni = (ny * width + nx) * 4;
                                    totalR += tempData[ni];
                                    totalG += tempData[ni + 1];
                                    totalB += tempData[ni + 2];
                                    count++;
                                }
                            }
                        }
                        
                        data[index] = Math.round(totalR / count);
                        data[index + 1] = Math.round(totalG / count);
                        data[index + 2] = Math.round(totalB / count);
                    }
                }
            }
        }
        
        for (let iteration = 0; iteration < 2; iteration++) {
            const newData = new Uint8ClampedArray(data);
            
            for (let y = 2; y < height - 2; y++) {
                for (let x = 2; x < width - 2; x++) {
                    const index = (y * width + x) * 4;
                    
                    if (mask[y * width + x]) {
                        let totalR = 0, totalG = 0, totalB = 0;
                        let count = 0;
                        
                        for (let dy = -2; dy <= 2; dy++) {
                            for (let dx = -2; dx <= 2; dx++) {
                                if (dx === 0 && dy === 0) continue;
                                
                                const nx = x + dx;
                                const ny = y + dy;
                                const ni = (ny * width + nx) * 4;
                                
                                if (!mask[ny * width + nx]) {
                                    totalR += newData[ni];
                                    totalG += newData[ni + 1];
                                    totalB += newData[ni + 2];
                                    count++;
                                }
                            }
                        }
                        
                        if (count > 0) {
                            const alpha = 0.3;
                            data[index] = Math.round(data[index] * (1 - alpha) + (totalR / count) * alpha);
                            data[index + 1] = Math.round(data[index + 1] * (1 - alpha) + (totalG / count) * alpha);
                            data[index + 2] = Math.round(data[index + 2] * (1 - alpha) + (totalB / count) * alpha);
                        }
                    }
                }
            }
        }
    }

    clearSelection() {
        if (!this.selectedImageId) return;
        
        const imageItem = this.images.find(img => img.id === this.selectedImageId);
        if (imageItem) {
            imageItem.clearMask();
            this.redrawCanvas(imageItem);
            this.updateButtonStates();
        }
    }

    resetImage() {
        if (!this.selectedImageId) return;
        
        const imageItem = this.images.find(img => img.id === this.selectedImageId);
        if (imageItem) {
            imageItem.reset();
            this.loadImageToCanvas(imageItem);
            this.renderImageList();
            this.updateButtonStates();
        }
    }

    removeImage(id) {
        this.images = this.images.filter(img => img.id !== id);
        
        if (this.selectedImageId === id) {
            this.selectedImageId = null;
            this.canvas.width = 0;
            this.canvas.height = 0;
            this.canvasStatus.textContent = '未选择图片';
            this.canvasOverlay.style.display = 'flex';
        } else if (this.selectedImageId) {
            const imageItem = this.images.find(img => img.id === this.selectedImageId);
            if (imageItem) {
                this.loadImageToCanvas(imageItem);
            }
        }
        
        this.renderImageList();
        this.updateButtonStates();
    }

    downloadAll() {
        const processedImages = this.images.filter(img => img.processed || img.hasMask());
        
        processedImages.forEach((imageItem, index) => {
            setTimeout(() => {
                const img = imageItem.processedImage || imageItem.originalImage;
                const link = document.createElement('a');
                link.download = `processed_${imageItem.name}`;
                link.href = img.src;
                link.click();
            }, index * 300);
        });
    }

    renderImageList() {
        this.imageList.innerHTML = '';
        this.imageCount.textContent = `${this.images.length} 张`;
        
        if (this.images.length === 0) {
            this.imageList.innerHTML = `
                <div class="empty-state">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <rect x="3" y="3" width="18" height="18" rx="2" />
                        <circle cx="8.5" cy="8.5" r="1.5" />
                        <polyline points="21 15 16 10 5 21" />
                    </svg>
                    <p>暂无图片</p>
                </div>
            `;
            return;
        }
        
        this.images.forEach(imageItem => {
            const div = document.createElement('div');
            div.className = `image-item ${imageItem.selected ? 'selected' : ''}`;
            div.innerHTML = `
                <img src="${imageItem.getCurrentImage().src}" alt="${imageItem.name}">
                ${imageItem.processed ? '<div class="processed-badge"></div>' : ''}
                <div class="image-info">
                    <span>${imageItem.name}</span>
                    <button onclick="remover.removeImage('${imageItem.id}')">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                </div>
            `;
            div.addEventListener('click', (e) => {
                if (!e.target.closest('button')) {
                    this.selectImage(imageItem.id);
                }
            });
            this.imageList.appendChild(div);
        });
    }

    updateButtonStates() {
        const hasImage = this.selectedImageId !== null;
        const imageItem = this.selectedImageId ? this.images.find(img => img.id === this.selectedImageId) : null;
        const hasMask = imageItem && imageItem.hasMask();
        const hasProcessed = imageItem && imageItem.processed;
        const hasAnyProcessed = this.images.some(img => img.processed);
        
        this.removeWatermarkBtn.disabled = !hasMask;
        this.clearSelectionBtn.disabled = !hasMask;
        this.resetImageBtn.disabled = !hasImage || (!hasMask && !hasProcessed);
        this.downloadAllBtn.disabled = !hasAnyProcessed;
    }

    showLoading(show) {
        this.loadingOverlay.classList.toggle('show', show);
    }
}

const remover = new WatermarkRemover();