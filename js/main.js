import { ImageConverter } from './converters/ImageConverter.js';
import { HtmlConverter } from './converters/HtmlConverter.js';
import { SvgConverter } from './converters/SvgConverter.js';

(() => {
    const SUPPORTED_FORMATS = {
        images: ['jpg', 'jpeg', 'png'],
        html: ['html', 'htm'],
        vector: ['svg']
    };

    const MAX_PARALLEL_CONVERSIONS = 3;
    const MAX_FILES = 10;
    let mobileQueue = [];
    let convertersRef;

    document.addEventListener('DOMContentLoaded', initializeApp);

    function initializeApp() {
        const { jsPDF } = window.jspdf;
        if (!jsPDF) {
            console.error('jsPDF nicht geladen');
            return;
        }

        const dropZone = document.getElementById('dropZone');
        const convertButton = dropZone.querySelector('.convert-button');
        const converters = {
            image: new ImageConverter(jsPDF),
            html: new HtmlConverter(jsPDF),
            svg: new SvgConverter(jsPDF)
        };

        setupEventListeners(dropZone, convertButton, converters);
    }

    function setupEventListeners(dropZone, convertButton, converters) {
        const dropEvents = ['dragenter', 'dragover', 'dragleave', 'drop'];
        
        dropEvents.forEach(event => {
            dropZone.addEventListener(event, preventDefault);
            document.body.addEventListener(event, preventDefault);
        });

        ['dragenter', 'dragover'].forEach(event => 
            dropZone.addEventListener(event, () => dropZone.classList.add('drag-over'))
        );

        ['dragleave', 'drop'].forEach(event => 
            dropZone.addEventListener(event, () => dropZone.classList.remove('drag-over'))
        );

        dropZone.addEventListener('drop', e => handleFiles(e.dataTransfer.files, converters));
        convertButton.addEventListener('click', () => createFileInput(converters));

        setupDownloadTriggers(dropZone);
    }

    async function handleFiles(files, converters) {
        if (!files?.length) return;
        
        const fileArray = Array.from(files);
        if (fileArray.length > MAX_FILES) {
            showNotification(`Maximal ${MAX_FILES} Dateien erlaubt`, 'error');
            return;
        }

        const chunks = chunkArray(fileArray, MAX_PARALLEL_CONVERSIONS);
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        convertersRef = converters;

        showProgress(true);

        try {
            if (isMobile) {
                mobileQueue = [];
                const mobileContainer = getMobileFilesContainer();
                
                for (const chunk of chunks) {
                    const results = await Promise.all(chunk.map(async file => {
                        const result = await convertFile(file, converters);
                        return { file, ...result };
                    }));
                    mobileQueue.push(...results);
                }
                
                updateMobileFilesList(mobileContainer);
            } else {
                for (const chunk of chunks) {
                    await Promise.all(chunk.map(file => processFile(file, converters)));
                }
            }
        } catch (error) {
            console.error('Fehler bei der Dateiverarbeitung:', error);
            showNotification(error.message, 'error');
        } finally {
            showProgress(false);
        }
    }

    async function convertFile(file, converters) {
        const extension = file.name.split('.').pop().toLowerCase();
        let converter;
        
        if (SUPPORTED_FORMATS.images.includes(extension)) converter = converters.image;
        else if (SUPPORTED_FORMATS.html.includes(extension)) converter = converters.html;
        else if (SUPPORTED_FORMATS.vector.includes(extension)) converter = converters.svg;
        else throw new Error(`Nicht unterstütztes Dateiformat: ${extension}`);

        const pdf = await converter.convertToPdf(file);
        const blob = pdf.output('blob');
        const url = URL.createObjectURL(blob);
        
        return { 
            fileName: file.name.replace(/\.[^/.]+$/,""),
            url,
            originalName: file.name 
        };
    }

    function getMobileFilesContainer() {
        let container = document.querySelector('.mobile-files-container');
        if (!container) {
            container = document.createElement('div');
            container.className = 'mobile-files-container';
            container.style.cssText = 'margin-top: 20px; padding: 15px; background: var(--secondary-bg); border-radius: var(--border-radius);';
            
            const downloadAllBtn = document.createElement('button');
            downloadAllBtn.className = 'convert-button';
            downloadAllBtn.innerHTML = '<i class="fi fi-rr-download"></i> Alle herunterladen';
            downloadAllBtn.style.marginTop = '15px';
            downloadAllBtn.onclick = downloadAllFiles;
            
            container.appendChild(downloadAllBtn);
            document.getElementById('dropZone').after(container);
        }
        return container;
    }

    function updateMobileFilesList(container) {
        const oldList = container.querySelector('.mobile-files-list');
        if (oldList) oldList.remove();

        const list = document.createElement('div');
        list.className = 'mobile-files-list';
        list.style.cssText = 'margin-top: 15px;';

        mobileQueue.forEach((item, index) => {
            const fileItem = document.createElement('div');
            fileItem.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 10px; border-bottom: 1px solid rgba(0,0,0,0.1);';
            fileItem.innerHTML = `
                <span>${item.originalName}</span>
                <button class="download-btn" style="background: none; border: none; color: var(--accent-color); cursor: pointer;">
                    <i class="fi fi-rr-download"></i>
                </button>
            `;

            fileItem.querySelector('.download-btn').onclick = () => downloadFile(item);
            list.appendChild(fileItem);
        });

        container.insertBefore(list, container.querySelector('.convert-button'));
    }

    async function downloadAllFiles() {
        for (const item of mobileQueue) {
            await downloadFile(item);
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }

    async function downloadFile(item) {
        const link = document.createElement('a');
        link.href = item.url;
        link.download = `${item.fileName}_converted.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    function createFileInput(converters) {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.jpg,.jpeg,.png,.html,.htm,.svg,image/jpeg,image/png,text/html,image/svg+xml';
        input.multiple = true;
        input.addEventListener('change', e => handleFiles(e.target.files, converters), { once: true });
        input.click();
    }

    function showProgress(show) {
        const existingProgress = document.querySelector('.progress');
        
        if (show && !existingProgress) {
            const progress = document.createElement('div');
            progress.className = 'progress';
            progress.innerHTML = '<div class="progress-bar"><div class="progress-fill"></div></div>';
            document.getElementById('dropZone').appendChild(progress);
        } else if (!show && existingProgress) {
            existingProgress.remove();
        }
    }

    function showNotification(message, type) {
        requestAnimationFrame(() => {
            const notification = document.createElement('div');
            notification.className = `notification ${type}`;
            notification.textContent = message;
            document.body.appendChild(notification);

            requestAnimationFrame(() => {
                notification.classList.add('show');
                setTimeout(() => {
                    notification.classList.remove('show');
                    setTimeout(() => notification.remove(), 300);
                }, 3000);
            });
        });
    }

    function preventDefault(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    function chunkArray(array, size) {
        const chunks = [];
        for (let i = 0; i < array.length; i += size) {
            chunks.push(array.slice(i, i + size));
        }
        return chunks;
    }

    function setupDownloadTriggers(dropZone) {
        document.addEventListener('paste', async (e) => {
            const items = (e.clipboardData || e.originalEvent.clipboardData).items;
            const files = [];
            
            for (const item of items) {
                if (item.kind === 'file') {
                    files.push(item.getAsFile());
                }
            }
            
            if (files.length > 0) {
                e.preventDefault();
                await handleFiles(files, converters);
            }
        });
    }
})();