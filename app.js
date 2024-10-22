// Sélecteurs
const recordButton = document.querySelector('.record');
const stopButton = document.querySelector('.stop');
const soundClips = document.querySelector('.sound-clips');
const canvas = document.querySelector('.visualizer');
const combineButton = document.querySelector('.combine');
const timerDisplay = document.createElement('div');

// Mode pro
const proModeToggle = document.querySelector('.pro-mode-toggle');

//Importation
const importButton = document.querySelector('.import-button');
const fileInput = document.querySelector('.file-input');

// Bouton de normalisation
const normalizeButton = document.createElement('button');
normalizeButton.textContent = 'Combiner et Normaliser';
normalizeButton.className = 'normalize';
// Cacher le bouton de normalisation par défaut
normalizeButton.classList.add('hidden');
normalizeButton.style.display = 'none';

// Affichage du mode pro
let isProMode = false;
proModeToggle.addEventListener('click', () => {
    isProMode = !isProMode;
    proModeToggle.classList.toggle('pro-mode-active', isProMode);
    proModeToggle.textContent = isProMode ? '➖' : '➕';
    importButton.classList.toggle('visible', isProMode);
    // Afficher/masquer le bouton de normalisation en fonction du mode pro
    normalizeButton.style.display = isProMode ? 'inline-block' : 'none';
    normalizeButton.classList.toggle('visible', isProMode);
});




timerDisplay.className = 'timer-display';
timerDisplay.style.display = 'none';

let startTime;
let timerInterval;
let recordingDuration = 0;

// Optimisation selon la plateforme
function getSupportedMimeType() {
    const possibleTypes = [
        'audio/ogg; codecs=opus',
        'audio/webm',
        'audio/mp4',
        'audio/aac'
    ];
    
    for (const type of possibleTypes) {
        if (MediaRecorder.isTypeSupported(type)) {
            console.log(`Type MIME utilisé ${type}`);
            return type;
        }
    }
    
    // Fallback pour iOS
    if (/iPad|iPhone|iPod/.test(navigator.userAgent)) {
        return 'audio/mp4';
    }
    
    throw new Error('Aucun format audio supporté n\'a été trouvé');
}

function getOptimalAudioSettings(mimeType) {
    const settings = {
        'audio/mp4': {
            audioBitsPerSecond: 96000,
            sampleRate: 44100,
            channelCount: 1
        },
        'audio/ogg; codecs=opus': {
            audioBitsPerSecond: 128000,
            sampleRate: 48000,
            channelCount: 1
        },
        'audio/webm': {
            audioBitsPerSecond: 128000,
            sampleRate: 48000,
            channelCount: 1
        },
        'audio/aac': {
            audioBitsPerSecond: 96000,
            sampleRate: 44100,
            channelCount: 1
        }
    };

    return settings[mimeType] || {
        audioBitsPerSecond: 128000,
        sampleRate: 44100,
        channelCount: 1
    };
}

// Conteneur pour le bouton combine
const combineButtonContainer = document.createElement('div');
combineButtonContainer.style.textAlign = 'center';
combineButtonContainer.style.margin = '20px 0';
combineButtonContainer.appendChild(combineButton);
combineButtonContainer.appendChild(normalizeButton);

// Section des clips combinés
const combinedClipsContainer = document.createElement('div');
combinedClipsContainer.className = 'combined-clips';
const combinedTitle = document.createElement('h3');
combinedTitle.textContent = 'Clips Combinés';
combinedTitle.style.marginTop = '20px';
combinedClipsContainer.appendChild(combinedTitle);

// Containers de la page
soundClips.parentNode.insertBefore(timerDisplay, soundClips);
soundClips.parentNode.insertBefore(combineButtonContainer, soundClips.nextSibling);
soundClips.parentNode.insertBefore(combinedClipsContainer, combineButtonContainer.nextSibling);

// Désactiver le bouton stop au démarrage
stopButton.disabled = true;

// Configuration du visualiseur
let audioCtx;
const canvasCtx = canvas.getContext("2d");

// Fonction pour formater le temps
function formatTime(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

// Fonction pour le décompte
function startCountdown() {
    return new Promise((resolve) => {
        let count = 3;
        const countdownEl = document.createElement('div');
        countdownEl.className = 'countdown';
        document.body.appendChild(countdownEl);
        const countInterval = setInterval(() => {
            if (count > 0) {
                countdownEl.textContent = count;
                count--;
            } else {
                clearInterval(countInterval);
                countdownEl.remove();
                resolve();
            }
        }, 1000);
        countdownEl.textContent = count;
    });
}

// Fonction pour démarrer le timer d'enregistrement
function startRecordingTimer() {
    startTime = Date.now();
    timerDisplay.style.display = 'block';
    timerDisplay.textContent = '0:00';
    
    timerInterval = setInterval(() => {
        const currentTime = Date.now();
        recordingDuration = currentTime - startTime;
        timerDisplay.textContent = formatTime(recordingDuration);
    }, 1000);
}

// Fonction pour arrêter le timer
function stopRecordingTimer() {
    clearInterval(timerInterval);
    timerDisplay.style.display = 'none';
    recordingDuration = 0;
}

function detectAudioFormat(audioElement) {
    const sourceUrl = audioElement.src;
    if (sourceUrl.includes('blob:')) {
        // Pour les blobs, on vérifie le type MIME
        return audioElement.type || 'audio/wav'; // Par défaut WAV si non spécifié
    }
    
    // Pour les URLs, on vérifie l'extension
    if (sourceUrl.endsWith('.ogg')) return 'audio/ogg';
    if (sourceUrl.endsWith('.webm')) return 'audio/webm';
    if (sourceUrl.endsWith('.m4a') || sourceUrl.endsWith('.aac')) return 'audio/aac';
    if (sourceUrl.endsWith('.mp3')) return 'audio/mp3';
    return 'audio/wav'; // Format par défaut
}

// Encodage MP3 lamejs
if (typeof lamejs === 'undefined') {
    throw new Error('La bibliothèque lamejs n\'est pas chargée');
} else {console.log('Bibliothèque lamejs chargée')}

async function optimizedMp3Encode(audioData, sampleRate, channels, progressCallback) {
    if (!window.lamejs) {
        throw new Error('La bibliothèque lamejs n\'est pas disponible');
    }

    try {
        const mp3encoder = new lamejs.Mp3Encoder(channels, sampleRate, 128);
        const mp3Data = [];
        const samples = new Int16Array(audioData.length);
        
        // Conversion et normalisation des données audio
        for (let i = 0; i < audioData.length; i++) {
            const sample = Math.max(-1, Math.min(1, audioData[i]));
            samples[i] = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
        }

        // Traitement par blocs
        const blockSize = 1152;
        const numBlocks = Math.ceil(samples.length / blockSize);

        for (let i = 0; i < numBlocks; i++) {
            if (progressCallback) {
                progressCallback((i / numBlocks) * 100);
            }

            const start = i * blockSize;
            const end = Math.min(start + blockSize, samples.length);
            const leftChunk = samples.slice(start, end);
            
            // Padding si nécessaire
            if (leftChunk.length < blockSize) {
                const paddedChunk = new Int16Array(blockSize);
                paddedChunk.set(leftChunk);
                const mp3buf = mp3encoder.encodeBuffer(paddedChunk);
                if (mp3buf.length > 0) mp3Data.push(mp3buf);
            } else {
                const mp3buf = mp3encoder.encodeBuffer(leftChunk);
                if (mp3buf.length > 0) mp3Data.push(mp3buf);
            }

            // Pause périodique
            if (i % 10 === 0) {
                await new Promise(resolve => setTimeout(resolve, 0));
            }
        }

        const mp3buf = mp3encoder.flush();
        if (mp3buf.length > 0) {
            mp3Data.push(mp3buf);
        }

        return new Blob(mp3Data, { type: 'audio/mp3' });
    } catch (error) {
        console.error('Erreur lors de l\'encodage MP3:', error);
        throw error;
    }
}


// Conversion MP3
async function convertToMp3(audioElement, progressCallback) {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    
    try {
        // Récupération des données audio
        const response = await fetch(audioElement.src);
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        
        // Extraction des données en mono
        const channelData = audioBuffer.getChannelData(0);
        
        // Encodage MP3
        return await optimizedMp3Encode(
            channelData,
            audioBuffer.sampleRate,
            1, // Force mono
            progressCallback
        );
        
    } catch (error) {
        console.error('Erreur lors de la conversion:', error);
        throw error;
    } finally {
        await audioContext.close();
    }
}



// Enregistrement audio
if (navigator.mediaDevices.getUserMedia) {
    console.log('getUserMedia supporté.');
    const constraints = { audio: true };

    let onSuccess = function(stream) {
        let mimeType;
        try {
            mimeType = getSupportedMimeType();
        } catch (e) {
            console.error(e);
            alert('Votre navigateur ne supporte pas l\'enregistrement audio.');
            return;
        }

        const audioSettings = getOptimalAudioSettings(mimeType);
        const mediaRecorder = new MediaRecorder(stream, {
            mimeType: mimeType,
            ...audioSettings
        });

        visualize(stream);

        let chunks = [];

        recordButton.onclick = async function() {
            await startCountdown();
            mediaRecorder.start();
            console.log(mediaRecorder.state);
            console.log("démarrage enregistrement");
            stopButton.disabled = false;
            recordButton.disabled = true;
            recordButton.classList.add('recording');
            startRecordingTimer();
        };

        stopButton.onclick = function() {
            mediaRecorder.stop();
            console.log(mediaRecorder.state);
            console.log("arrêt enregistrement");
            stopButton.disabled = true;
            recordButton.disabled = false;
            recordButton.classList.remove('recording');
            stopRecordingTimer();
        };

        mediaRecorder.onstop = function(e) {
            console.log("Données disponibles après l'arrêt de de MediaRecorder");

            const blob = new Blob(chunks, { type: mimeType });
            chunks = [];
            
            const clipName = prompt('Entrez un nom pour votre clip audio', 'sansNom');
            const clipContainer = document.createElement('article');
            const clipLabel = document.createElement('p');
            const audio = document.createElement('audio');
            const deleteButton = document.createElement('button');
            const downloadButton = document.createElement('button');
            const moveUpButton = document.createElement('button');
            const moveDownButton = document.createElement('button');

            clipContainer.classList.add('clip');
            audio.setAttribute('controls', '');
            deleteButton.textContent = 'Supprimer';
            deleteButton.className = 'delete';
            downloadButton.textContent = 'Télécharger';
            downloadButton.className = 'download';
            moveUpButton.textContent = '↑';
            moveUpButton.className = 'move-up';
            moveDownButton.textContent = '↓';
            moveDownButton.className = 'move-down';

            clipLabel.textContent = clipName || 'sansNom';

            clipContainer.appendChild(moveUpButton);
            clipContainer.appendChild(moveDownButton);
            clipContainer.appendChild(clipLabel);
            clipContainer.appendChild(audio);
            clipContainer.appendChild(deleteButton);
            clipContainer.appendChild(downloadButton);
            soundClips.appendChild(clipContainer);

            const audioURL = window.URL.createObjectURL(blob);
            audio.src = audioURL;

            deleteButton.onclick = function(e) {
                e.target.parentNode.remove();
            };

            clipLabel.onclick = function() {
                const newClipName = prompt('Entrez un nouveau nom pour votre clip audio');
                if(newClipName !== null) {
                    this.textContent = newClipName;
                }
            };

            downloadButton.onclick = function() {
                const extension = mimeType.includes('mp4') || mimeType.includes('aac') ? 'm4a' : 
                                mimeType.includes('webm') ? 'webm' : 'ogg';
                const anchor = document.createElement('a');
                anchor.href = audioURL;
                anchor.download = `${clipLabel.textContent}.${extension}`;
                anchor.click();
            };

            moveUpButton.onclick = function() {
                const previousSibling = clipContainer.previousElementSibling;
                if (previousSibling) {
                    soundClips.insertBefore(clipContainer, previousSibling);
                }
            };

            moveDownButton.onclick = function() {
                const nextSibling = clipContainer.nextElementSibling;
                if (nextSibling) {
                    soundClips.insertBefore(nextSibling, clipContainer);
                }
            };
        };

        mediaRecorder.ondataavailable = function(e) {
            chunks.push(e.data);
        };
    };

    let onError = function(err) {
        console.log('L\'erreur suivante s\'est produite : ' + err);
    };

    navigator.mediaDevices.getUserMedia(constraints).then(onSuccess, onError);

} else {
    console.log('getUserMedia n\'est pas supporté sur votre navigateur !');
}


// Fonctionnalité import
importButton.addEventListener('click', () => {
    fileInput.click();
});

fileInput.addEventListener('change', async (event) => {
    const file = event.target.files[0];
    if (file) {
        try {
            const audioBlob = await processImportedAudio(file);
            createAudioClip(audioBlob, file.name);
        } catch (error) {
            console.error('Erreur lors de l\'import', error);
            alert('Votre audio n\' pu être importé. Veuillez réessayer.');
        }
    }
});

async function processImportedAudio(file) {
    const arrayBuffer = await file.arrayBuffer();
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    
    // Conversion du fichier importé en mp3
    const mp3Blob = await convertToMp3FromAudioBuffer(audioBuffer);
    return mp3Blob;
}

async function convertToMp3FromAudioBuffer(audioBuffer, progressCallback) {
    const channelData = audioBuffer.getChannelData(0); 
    return await optimizedMp3Encode(
        channelData,
        audioBuffer.sampleRate,
        1, 
        progressCallback
    );
}

function createAudioClip(blob, fileName) {
    const clipContainer = document.createElement('article');
    const clipLabel = document.createElement('p');
    const audio = document.createElement('audio');
    const deleteButton = document.createElement('button');
    const downloadButton = document.createElement('button');
    const moveUpButton = document.createElement('button');
    const moveDownButton = document.createElement('button');

    clipContainer.classList.add('clip');
    audio.setAttribute('controls', '');
    deleteButton.textContent = 'Supprimer';
    deleteButton.className = 'delete';
    downloadButton.textContent = 'Télécharger';
    downloadButton.className = 'download';
    moveUpButton.textContent = '↑';
    moveUpButton.className = 'move-up';
    moveDownButton.textContent = '↓';
    moveDownButton.className = 'move-down';

    clipLabel.textContent = fileName.split('.').slice(0, -1).join('.') || 'Imported Audio';

    clipContainer.appendChild(moveUpButton);
    clipContainer.appendChild(moveDownButton);
    clipContainer.appendChild(clipLabel);
    clipContainer.appendChild(audio);
    clipContainer.appendChild(deleteButton);
    clipContainer.appendChild(downloadButton);
    soundClips.appendChild(clipContainer);

    const audioURL = window.URL.createObjectURL(blob);
    audio.src = audioURL;

    // Boutons du fichier importé
    deleteButton.onclick = function(e) {
        e.target.parentNode.remove();
    };

    clipLabel.onclick = function() {
        const newClipName = prompt('Entrez un nouveau nom pour votre clip audio');
        if(newClipName !== null) {
            this.textContent = newClipName;
        }
    };

    downloadButton.onclick = function() {
        const anchor = document.createElement('a');
        anchor.href = audioURL;
        anchor.download = `${clipLabel.textContent}.mp3`;
        anchor.click();
    };

    moveUpButton.onclick = function() {
        const previousSibling = clipContainer.previousElementSibling;
        if (previousSibling) {
            soundClips.insertBefore(clipContainer, previousSibling);
        }
    };

    moveDownButton.onclick = function() {
        const nextSibling = clipContainer.nextElementSibling;
        if (nextSibling) {
            soundClips.insertBefore(nextSibling, clipContainer);
        }
    };
}


// Oscilloscope
function visualize(stream) {
    if(!audioCtx) {
        audioCtx = new AudioContext();
    }

    const source = audioCtx.createMediaStreamSource(stream);

    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 2048;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    source.connect(analyser);

    draw();

    function draw() {
        const WIDTH = canvas.width;
        const HEIGHT = canvas.height;

        requestAnimationFrame(draw);

        analyser.getByteTimeDomainData(dataArray);

        canvasCtx.fillStyle = 'rgb(200, 200, 200)';
        canvasCtx.fillRect(0, 0, WIDTH, HEIGHT);

        canvasCtx.lineWidth = 2;
        canvasCtx.strokeStyle = 'rgb(0, 0, 0)';

        canvasCtx.beginPath();

        const sliceWidth = WIDTH * 1.0 / bufferLength;
        let x = 0;

        for(let i = 0; i < bufferLength; i++) {
            const v = dataArray[i] / 128.0;
            const y = v * HEIGHT/2;

            if(i === 0) {
                canvasCtx.moveTo(x, y);
            } else {
                canvasCtx.lineTo(x, y);
            }

            x += sliceWidth;
        }

        canvasCtx.lineTo(canvas.width, canvas.height/2);
        canvasCtx.stroke();
    }
}

// Fonction pour combiner les clips audio
combineButton.onclick = async function() {
    const audioElements = document.querySelectorAll('.sound-clips .clip audio');
    
    if (audioElements.length < 2) {
        alert('Vous devez avoir au moins deux clips audio pour les combiner.');
        return;
    }

    const combinedClipName = prompt('Entrez un nom pour votre clip combiné', 'clipCombiné');
    if (!combinedClipName) return;

    // Création de la barre de progression
    const progressContainer = document.createElement('div');
    const progressBar = document.createElement('div');
    progressContainer.style.cssText = 'width: 100%; background: #ddd; margin: 10px 0;';
    progressBar.style.cssText = 'width: 0%; height: 20px; background: #138496; transition: width 0.3s;';
    progressContainer.appendChild(progressBar);
    combineButtonContainer.appendChild(progressContainer);
    
    try {
        combineButton.disabled = true;
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const mp3Blobs = [];

        // Conversion de chaque clip en MP3
        for (let i = 0; i < audioElements.length; i++) {
            const progress = (percent) => {
                const totalProgress = (i * 100 + percent) / audioElements.length;
                progressBar.style.width = `${totalProgress}%`;
            };
            
            const mp3Blob = await convertToMp3(audioElements[i], progress);
            mp3Blobs.push(mp3Blob);
        }

        // Concaténation des MP3
        const combinedBlob = new Blob(mp3Blobs, { type: 'audio/mp3' });
        const combinedUrl = URL.createObjectURL(combinedBlob);

        // Création du combiné
        const combinedClip = document.createElement('article');
        combinedClip.classList.add('clip');
        
        const combinedAudio = document.createElement('audio');
        combinedAudio.controls = true;
        combinedAudio.src = combinedUrl;
        
        const combinedLabel = document.createElement('p');
        combinedLabel.textContent = combinedClipName;
        
        const buttonsContainer = document.createElement('div');
        const downloadButton = document.createElement('button');
        const deleteButton = document.createElement('button');
        
        downloadButton.textContent = 'Télécharger';
        downloadButton.className = 'download';
        downloadButton.onclick = () => {
            const a = document.createElement('a');
            a.href = combinedUrl;
            a.download = `${combinedClipName}.mp3`;
            a.click();
        };
        
        deleteButton.textContent = 'Supprimer';

        deleteButton.onclick = () => {
            combinedClip.remove();
            URL.revokeObjectURL(combinedUrl);
        };
        
        buttonsContainer.appendChild(deleteButton);
        buttonsContainer.appendChild(downloadButton);
        deleteButton.className = 'delete';
        combinedClip.appendChild(combinedLabel);
        combinedClip.appendChild(combinedAudio);
        combinedClip.appendChild(deleteButton);
        combinedClip.appendChild(downloadButton);
        
        combinedClipsContainer.appendChild(combinedClip);

    } catch (error) {
        console.error('Erreur lors de la combinaison:', error);
        alert(`Erreur lors de la combinaison des clips: ${error.message}`);
    } finally {
        combineButton.disabled = false;
        progressContainer.remove();
    }
    
    // Calcul du RMS
    function calculateRMS(audioBuffer) {
        let sum = 0;
        for (let i = 0; i < audioBuffer.length; i++) {
            sum += audioBuffer[i] * audioBuffer[i];
        }
        return Math.sqrt(sum / audioBuffer.length);
    }
    
    // Fonction pour normaliser
    async function normalizeAudioBuffer(audioContext, audioBuffer, targetRMS = 0.2) {
        const numberOfChannels = audioBuffer.numberOfChannels;
        const normalizedBuffer = audioContext.createBuffer(
            numberOfChannels,
            audioBuffer.length,
            audioBuffer.sampleRate
        );
    
        for (let channel = 0; channel < numberOfChannels; channel++) {
            const channelData = audioBuffer.getChannelData(channel);
            const currentRMS = calculateRMS(channelData);
            const gainFactor = targetRMS / currentRMS;
    
            const normalizedData = new Float32Array(channelData.length);
            for (let i = 0; i < channelData.length; i++) {
                normalizedData[i] = channelData[i] * gainFactor;
            }
            normalizedBuffer.copyToChannel(normalizedData, channel);
        }
    
        return normalizedBuffer;
    }
    
    // Bouton de normalisation
    normalizeButton.onclick = async function() {
        const audioElements = document.querySelectorAll('.sound-clips .clip audio');
        
        if (audioElements.length < 2) {
            alert('Vous devez avoir au moins deux clips audio pour les combiner.');
            return;
        }
    
        const combinedClipName = prompt('Entrez un nom pour votre clip normalisé', 'clipNormalisé');
        if (!combinedClipName) return;
    
        // Création de la barre de progression
        const progressContainer = document.createElement('div');
        const progressBar = document.createElement('div');
        progressContainer.className = 'progress-bar-container';
        progressBar.className = 'progress-bar';
        progressContainer.appendChild(progressBar);
        combineButtonContainer.appendChild(progressContainer);
        
        try {
            normalizeButton.disabled = true;
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const audioBuffers = [];
    
            // Chargement et normalisation de chaque clip
            for (let i = 0; i < audioElements.length; i++) {
                const response = await fetch(audioElements[i].src);
                const arrayBuffer = await response.arrayBuffer();
                const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
                
                // Normalisation du buffer
                const normalizedBuffer = await normalizeAudioBuffer(audioContext, audioBuffer);
                audioBuffers.push(normalizedBuffer);
                
                progressBar.style.width = `${((i + 1) / audioElements.length) * 50}%`;
            }
    
            // Création du buffer final
            const totalLength = audioBuffers.reduce((sum, buffer) => sum + buffer.length, 0);
            const combinedBuffer = audioContext.createBuffer(
                1, // Mono output
                totalLength,
                audioContext.sampleRate
            );
    
            // Combinaison des buffers normalisés
            let offset = 0;
            for (const buffer of audioBuffers) {
                const channelData = buffer.getChannelData(0);
                combinedBuffer.copyToChannel(channelData, 0, offset);
                offset += buffer.length;
            }
    
            // Conversion en MP3
            const offlineContext = new OfflineAudioContext(
                1,
                combinedBuffer.length,
                combinedBuffer.sampleRate
            );
            
            const source = offlineContext.createBufferSource();
            source.buffer = combinedBuffer;
            source.connect(offlineContext.destination);
            source.start();
    
            const renderedBuffer = await offlineContext.startRendering();
            const mp3Blob = await optimizedMp3Encode(
                renderedBuffer.getChannelData(0),
                renderedBuffer.sampleRate,
                1,
                (progress) => {
                    progressBar.style.width = `${50 + progress / 2}%`;
                }
            );
    
            // Création du clip combiné
            const combinedUrl = URL.createObjectURL(mp3Blob);
            const combinedClip = document.createElement('article');
            combinedClip.classList.add('clip');
            
            const combinedAudio = document.createElement('audio');
            combinedAudio.controls = true;
            combinedAudio.src = combinedUrl;
            
            const combinedLabel = document.createElement('p');
            combinedLabel.textContent = combinedClipName;
            
            const deleteButton = document.createElement('button');
            deleteButton.textContent = 'Supprimer';
            deleteButton.className = 'delete';
            
            const downloadButton = document.createElement('button');
            downloadButton.textContent = 'Télécharger';
            downloadButton.className = 'download';
            
            deleteButton.onclick = () => {
                combinedClip.remove();
                URL.revokeObjectURL(combinedUrl);
            };
            
            downloadButton.onclick = () => {
                const a = document.createElement('a');
                a.href = combinedUrl;
                a.download = `${combinedClipName}.mp3`;
                a.click();
            };
    
            combinedClip.appendChild(combinedLabel);
            combinedClip.appendChild(combinedAudio);
            combinedClip.appendChild(deleteButton);
            combinedClip.appendChild(downloadButton);
            
            combinedClipsContainer.appendChild(combinedClip);
    
        } catch (error) {
            console.error('Erreur lors de la normalisation et combinaison:', error);
            alert(`Erreur lors de la normalisation: ${error.message}`);
        } finally {
            normalizeButton.disabled = false;
            progressContainer.remove();
        }
    };
}
