class VideoPlayer extends HTMLElement {
	constructor() {
		super();
		this.attachShadow({ mode: 'open' });
		this.hasInteracted = false;
		/** @type {number|null} */
		this.hideControlsTimeout = null;
		this.isSeeking = false;
		this.wasPlaying = false;
		/** @type {IntersectionObserver|null} */
		this.observer = null;
		/** @type {number|null} */
		this.fadeoutTimeout = null;
		this.isTouchDevice = false;
		this.isInView = false;
		this.hasAutoPlayed = false;

		// DOM element references
		/** @type {HTMLVideoElement|null} */
		this.video = null;
		/** @type {HTMLElement|null} */
		this.videoContainer = null;
		/** @type {HTMLElement|null} */
		this.playButton = null;
		/** @type {HTMLElement|null} */
		this.muteButton = null;
		/** @type {HTMLElement|null} */
		this.fullscreenButton = null;
		/** @type {HTMLElement|null} */
		this.videoOverlay = null;
		/** @type {HTMLElement|null} */
		this.controls = null;
		/** @type {HTMLElement|null} */
		this.progressBar = null;
		/** @type {HTMLElement|null} */
		this.progressBarFill = null;
		/** @type {HTMLElement|null} */
		this.mobilePlayButton = null;
		/** @type {HTMLElement|null} */
		this.mobileMuteButton = null;
		/** @type {HTMLElement|null} */
		this.mobileControls = null;
		/** @type {HTMLElement|null} */
		this.volumeBars = null;
	}

	connectedCallback() {
		// Check for touch device before rendering
		this.isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
		this.render(this.isTouchDevice);

		// First initialize all elements
		this.video = this.shadowRoot.querySelector('video');
		this.videoContainer = this;

		// Initialize controls based on device type
		if (!this.isTouchDevice) {
			// Desktop controls
			this.playButton = this.shadowRoot.querySelector('#playButton');
			this.muteButton = this.shadowRoot.querySelector('#muteButton');
			this.fullscreenButton = this.shadowRoot.querySelector('#fullscreenButton');
			this.videoOverlay = this.shadowRoot.querySelector('.video-overlay');
			this.controls = this.shadowRoot.querySelector('.controls');
			this.progressBar = this.shadowRoot.querySelector('.progress-bar');
			this.progressBarFill = this.shadowRoot.querySelector('.progress-bar-fill');
		} else {
			// Mobile controls
			this.mobilePlayButton = this.shadowRoot.querySelector('#mobilePlayButton');
			this.mobileMuteButton = this.shadowRoot.querySelector('#mobileMuteButton');
			this.mobileControls = this.shadowRoot.querySelector('.mobile-controls');
		}

		// Add event listeners only after confirming video exists
		if (this.video) {
			if (!this.isTouchDevice) {
				// Desktop event listeners
				this.updateMuteButtonIcon(true);

				if (this.playButton) this.playButton.addEventListener('click', () => this.togglePlay());
				if (this.videoOverlay) this.videoOverlay.addEventListener('click', () => this.togglePlay());
				if (this.muteButton) this.muteButton.addEventListener('click', () => this.toggleMute());
				if (this.fullscreenButton)
					this.fullscreenButton.addEventListener('click', () => this.toggleFullscreen());

				// Progress bar event listeners
				this.video.addEventListener('timeupdate', () => this.updateProgressBar());
				if (this.progressBar) {
					this.progressBar.addEventListener('mousedown', (e) => this.startSeeking(e));
					this.progressBar.addEventListener('mousemove', (e) => this.seeking(e));
					this.progressBar.addEventListener('mouseup', () => this.endSeeking());
					this.progressBar.addEventListener('mouseleave', () => this.endSeeking());
				}

				// Desktop hover controls - only show on hover
				this.addEventListener('mouseenter', () => this.showControls());
				this.addEventListener('mouseleave', () => this.hideControls());
			} else {
				// Mobile event listeners
				if (this.mobilePlayButton)
					this.mobilePlayButton.addEventListener('click', () => this.togglePlay());
				if (this.mobileMuteButton)
					this.mobileMuteButton.addEventListener('click', () => this.toggleMute());
				this.video.addEventListener('click', () => this.handleMobileVideoTap());
			}

			// Keep visibility change handler for all devices
			document.addEventListener('visibilitychange', () => this.handleVisibilityChange());

			// Initial state
			this.video.muted = true;

			// Handle autoplay differently for mobile vs desktop
			if (this.hasAttribute('autoplay')) {
				if (this.isTouchDevice) {
					// On mobile, don't autoplay immediately - wait for intersection
					this.classList.add('paused');
					this.updatePlayButtonIcon(true);
				} else {
					// On desktop, autoplay as normal
					this.video.play().catch(() => {
						this.classList.add('paused');
					});
					this.updatePlayButtonIcon(false);
				}
			} else {
				this.classList.add('paused');
				this.updatePlayButtonIcon(true);
			}

			// Set loop based on attribute
			this.video.loop = this.hasAttribute('loop');
		} else {
			console.error('Required video element not found');
		}

		this.setupIntersectionObserver();

		if (!this.isTouchDevice) {
			this.volumeBars = this.shadowRoot.querySelector('#volumeBars');
			if (this.volumeBars)
				this.volumeBars.addEventListener('click', (e) => this.handleVolumeBarClick(e));
			this.updateVolumeBars(this.video?.volume || 0);

			// Initially hide controls on desktop
			this.hideControls();
		}

		// Add fullscreen change handler
		document.addEventListener('fullscreenchange', () => this.handleFullscreenChange());

		// Add accessibility features
		this.setupAccessibilityFeatures();

		// Add caption setup
		if (this.video) {
			this.video.addEventListener('loadedmetadata', () => {
				this.setupCaptions();
			});
		}
	}

	render(isTouchDevice = false) {
		const videoUrl = this.getAttribute('video-url');
		const posterUrl = this.getAttribute('video-poster');
		const title = this.getAttribute('video-title');
		const description = this.getAttribute('video-description');
		const isMuted = this.hasAttribute('muted');
		const playsInline = this.hasAttribute('playsinline');
		const autoPlay = this.hasAttribute('autoplay');
		const loop = this.hasAttribute('loop');

		this.shadowRoot.innerHTML = `
            <style>
                :host {
                    display: block;
                    position: relative;
                    background-color: black;
                    overflow: hidden;
                    --theme-color: var(--video-theme-color, #eab308);
                    text-align: left;
                    container-type: inline-size;
                    width: 100%;
                    height: 100%;
                }

                :host(:fullscreen) {
                    border-radius: 0 !important;
                }

                .video {
                    pointer-events: ${isTouchDevice ? 'auto' : 'none'};
                    z-index: 10;
                    width: 100%;
                    height: 100%;
                    object-fit: contain;
                    display: block;
                }
                
                .video-info {
                    position: static;
                    padding: 0 12px;
                    color: white;
                    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.4);
                    margin-bottom: 12px;
                }
                
                .video-info h2 {
                    margin: 0 0 4px;
                    font-size: 18px;
                    font-weight: 700;
                }
                
                .video-info p {
                    margin: 0;
                    font-size: 14px;
                    line-height: 18px;
                    opacity: 0.74;
                }

                .video-info h2,
                .video-info p{
                    overflow: hidden;
                    display: -webkit-box;
                    -webkit-line-clamp: 1;
                    line-clamp: 1; 
                    -webkit-box-orient: vertical;
                }
                
                :host(.paused) .video-info {
                    opacity: 1;
                }

                ${
									!isTouchDevice
										? `
                    .video-overlay {
                        position: absolute;
                        top: 0;
                        right: 0;
                        bottom: 0;
                        left: 0;
                        z-index: 20;
                        opacity: 0;
                        background: linear-gradient(to bottom, rgba(0, 0, 0, 0) 0%, rgba(0, 0, 0, 0.6) 80%);
                        cursor: pointer;
                        transition: opacity 200ms linear;
                    }
                    
                    .video-overlay:hover{
                        opacity: 0.4;
                    }
                    
                    :host(.paused) .video-overlay{
                        opacity: 1;
                    }
                    
                    .controls {
                        position: absolute;
                        bottom: 0;
                        left: 0;
                        right: 0;
                        z-index: 30;
                        opacity: 0;
                        transition: opacity 300ms ease;
                        pointer-events: none;
                    }
                    
                    .controls.visible {
                        opacity: 1;
                        pointer-events: auto;
                    }
                    
                    :host(.paused) .controls {
                        opacity: 1;
                        pointer-events: auto;
                    }
                    
                    .controls-bottom {
                        background: linear-gradient(to top, rgba(0, 0, 0, 0.8) 0%, rgba(0, 0, 0, 0.4) 50%, transparent 100%);
                        padding: 20px 16px 16px;
                        display: flex;
                        flex-direction: column;
                        gap: 12px;
                    }
                    
                    .progress-bar-container {
                        width: 100%;
                    }
                    
                    .progress-bar {
                        width: 100%;
                        height: 6px;
                        background: rgba(255, 255, 255, 0.3);
                        border-radius: 3px;
                        position: relative;
                        cursor: pointer;
                    }
                    
                    .progress-bar-fill {
                        height: 100%;
                        background: var(--theme-color);
                        border-radius: 3px;
                        width: 0%;
                        transition: width 0.1s ease;
                    }
                    
                    .seek-handle {
                        position: absolute;
                        top: 50%;
                        transform: translate(-50%, -50%);
                        width: 14px;
                        height: 14px;
                        background: white;
                        border-radius: 50%;
                        opacity: 0;
                        transition: opacity 0.2s ease;
                        pointer-events: none;
                    }
                    
                    .progress-bar:hover .seek-handle {
                        opacity: 1;
                    }
                    
                    .buttons-container {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                    }
                    
                    .left-controls {
                        display: flex;
                        align-items: center;
                        gap: 16px;
                    }
                    
                    .right-controls {
                        display: flex;
                        align-items: center;
                        gap: 16px;
                    }
                    
                    .button-group {
                        display: flex;
                        align-items: center;
                        gap: 12px;
                    }
                    
                    .play-button {
                        background: none;
                        border: none;
                        color: white;
                        cursor: pointer;
                        padding: 8px;
                        border-radius: 6px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        transition: background-color 0.2s ease;
                        width: 40px;
                        height: 40px;
                    }
                    
                    .play-button:hover {
                        background: rgba(255, 255, 255, 0.2);
                    }
                    
                    .play-button-inner {
                        display: flex;
                        align-items: center;
                        justify-content: center;
                    }
                    
                    button {
                        background: none;
                        border: none;
                        color: white;
                        cursor: pointer;
                        padding: 8px;
                        border-radius: 6px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        transition: background-color 0.2s ease;
                        width: 36px;
                        height: 36px;
                    }
                    
                    button:hover {
                        background: rgba(255, 255, 255, 0.2);
                    }
                    
                    .volume-bars {
                        display: flex;
                        align-items: center;
                        gap: 2px;
                        padding: 0 4px;
                    }
                    
                    .volume-bar {
                        width: 3px;
                        background: rgba(255, 255, 255, 0.4);
                        border-radius: 1px;
                        cursor: pointer;
                        transition: background-color 0.2s ease;
                    }
                    
                    .volume-bar:nth-child(1) { height: 8px; }
                    .volume-bar:nth-child(2) { height: 12px; }
                    .volume-bar:nth-child(3) { height: 16px; }
                    .volume-bar:nth-child(4) { height: 20px; }
                    .volume-bar:nth-child(5) { height: 24px; }
                    
                    .volume-bar.active {
                        background: var(--theme-color);
                    }
                    
                    .volume-bar:hover {
                        background: white;
                    }
                    
                    .time-display {
                        font-size: 14px;
                        font-family: monospace;
                        color: white;
                        white-space: nowrap;
                    }
                    
                    .icon {
                        width: 20px;
                        height: 20px;
                    }
                    
                    .sr-only {
                        position: absolute;
                        width: 1px;
                        height: 1px;
                        padding: 0;
                        margin: -1px;
                        overflow: hidden;
                        clip: rect(0, 0, 0, 0);
                        white-space: nowrap;
                        border: 0;
                    }
                `
										: `
                    /* Mobile styles */
                    .mobile-controls {
                        position: absolute;
                        top: 0;
                        left: 0;
                        right: 0;
                        bottom: 0;
                        z-index: 30;
                        opacity: 0;
                        transition: opacity 300ms ease;
                        pointer-events: none;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                    }
                    
                    .mobile-controls.visible {
                        opacity: 1;
                        pointer-events: auto;
                    }
                    
                    :host(.paused) .mobile-controls {
                        opacity: 1;
                        pointer-events: auto;
                    }
                    
                    .mobile-play-button {
                        background: rgba(0, 0, 0, 0.7);
                        border: none;
                        color: white;
                        cursor: pointer;
                        border-radius: 50%;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        width: 80px;
                        height: 80px;
                        backdrop-filter: blur(4px);
                        transition: all 0.2s ease;
                    }
                    
                    .mobile-play-button:active {
                        background: rgba(0, 0, 0, 0.9);
                        transform: scale(0.95);
                    }
                    
                    .mobile-mute-button {
                        position: absolute;
                        bottom: 16px;
                        right: 16px;
                        background: rgba(0, 0, 0, 0.7);
                        border: none;
                        color: white;
                        cursor: pointer;
                        border-radius: 50%;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        width: 48px;
                        height: 48px;
                        backdrop-filter: blur(4px);
                        transition: all 0.2s ease;
                    }
                    
                    .mobile-mute-button:active {
                        background: rgba(0, 0, 0, 0.9);
                        transform: scale(0.95);
                    }
                    
                    .sr-only {
                        position: absolute;
                        width: 1px;
                        height: 1px;
                        padding: 0;
                        margin: -1px;
                        overflow: hidden;
                        clip: rect(0, 0, 0, 0);
                        white-space: nowrap;
                        border: 0;
                    }
                `
								}
            </style>
            
            ${!isTouchDevice ? `<div class="video-overlay"></div>` : ''}
            
            <video 
                id="video" 
                class="video" 
                ${isMuted ? 'muted' : ''} 
                ${playsInline ? 'playsinline' : ''} 
                ${!isTouchDevice && autoPlay ? 'autoplay' : ''}
                ${posterUrl ? `poster="${posterUrl}"` : ''}
                ${loop ? 'loop' : ''}
            >
                <source src="${videoUrl}" type="video/mp4">
                Your browser does not support HTML5 video.
            </video>
            
            ${
							!isTouchDevice
								? `
                <div class="controls">
                    <div class="controls-bottom">
                        ${
													title || description
														? `
                            <div class="video-info">
                                ${title ? `<h2>${title}</h2>` : ''}
                                ${description ? `<p>${description}</p>` : ''}
                            </div>
                        `
														: ''
												}
                        <div class="progress-bar-container">
                            <div class="progress-bar">
                                <div class="progress-bar-fill"></div>
                                <div class="seek-handle"></div>
                            </div>
                        </div>
                        <div class="buttons-container">
                            <div class="left-controls">
                                <div class="button-group">
                                    <div id="playButton" class="play-button">
                                        <div class="play-button-inner">
                                            <svg width="14" height="16" viewBox="0 0 14 16" stroke="currentColor" xmlns="http://www.w3.org/2000/svg">
                                                <path d="M0.5 14.3507V1.64929C0.5 0.871991 1.34797 0.391878 2.0145 0.791793L12.599 7.14251C13.2464 7.53091 13.2464 8.46909 12.599 8.85749L2.0145 15.2082C1.34797 15.6081 0.5 15.128 0.5 14.3507Z" stroke-linecap="round" stroke-linejoin="round"/>
                                            </svg>
                                        </div>
                                        <span class="sr-only">Play</span>
                                    </div>
                                    <button id="muteButton">
                                        <span class="sr-only">Mute</span>
                                    </button>
                                    <div id="volumeBars" class="volume-bars">
                                        <div class="volume-bar" data-volume="0.2"></div>
                                        <div class="volume-bar" data-volume="0.4"></div>
                                        <div class="volume-bar" data-volume="0.6"></div>
                                        <div class="volume-bar" data-volume="0.8"></div>
                                        <div class="volume-bar" data-volume="1.0"></div>
                                    </div>
                                </div>
                            </div>
                            <div class="right-controls">
                                <div class="time-display">0:00 / 0:00</div>
                                <button id="fullscreenButton">
                                    <svg class="icon" id="fullscreenIcon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/>
                                    </svg>
                                    <span class="sr-only">Fullscreen</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `
								: `
                <div class="mobile-controls">
                    <button id="mobilePlayButton" class="mobile-play-button">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M8 5v14l11-7z"/>
                        </svg>
                        <span class="sr-only">Play</span>
                    </button>
                    <button id="mobileMuteButton" class="mobile-mute-button">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
                        </svg>
                        <span class="sr-only">Mute</span>
                    </button>
                </div>
            `
						}
        `;
	}

	handleMobileVideoTap() {
		if (this.video.paused) {
			this.video.play();
			// Hide controls after a delay when playing
			setTimeout(() => {
				if (!this.video.paused) {
					this.hideMobileControls();
				}
			}, 2000);
		} else {
			this.video.pause();
			this.showMobileControls();
		}
	}

	showMobileControls() {
		if (this.mobileControls) {
			this.mobileControls.classList.add('visible');
		}
	}

	hideMobileControls() {
		if (this.mobileControls && !this.video.paused) {
			this.mobileControls.classList.remove('visible');
		}
	}

	togglePlay() {
		if (this.video.paused) {
			this.video
				.play()
				.then(() => {
					this.classList.remove('paused');
					this.updatePlayButtonIcon(false);
					if (this.isTouchDevice) {
						// Hide mobile controls after starting playback
						setTimeout(() => {
							if (!this.video.paused) {
								this.hideMobileControls();
							}
						}, 2000);
					}
				})
				.catch(() => {
					console.log('Play failed');
				});
		} else {
			this.video.pause();
			this.classList.add('paused');
			this.updatePlayButtonIcon(true);
			if (this.isTouchDevice) {
				this.showMobileControls();
			}
		}
	}

	updatePlayButtonIcon(isPaused) {
		if (!this.isTouchDevice && this.playButton) {
			const playIcon = `
                <svg width="14" height="16" viewBox="0 0 14 16" stroke="currentColor" xmlns="http://www.w3.org/2000/svg">
                    <path d="M0.5 14.3507V1.64929C0.5 0.871991 1.34797 0.391878 2.0145 0.791793L12.599 7.14251C13.2464 7.53091 13.2464 8.46909 12.599 8.85749L2.0145 15.2082C1.34797 15.6081 0.5 15.128 0.5 14.3507Z" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
            `;
			const pauseIcon = `
                <svg width="14" height="16" viewBox="0 0 14 16" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                    <rect x="1" y="1" width="4" height="14" rx="1"/>
                    <rect x="9" y="1" width="4" height="14" rx="1"/>
                </svg>
            `;
			this.playButton.querySelector('.play-button-inner').innerHTML = isPaused
				? playIcon
				: pauseIcon;
		} else if (this.isTouchDevice && this.mobilePlayButton) {
			const playIcon = `
                <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M8 5v14l11-7z"/>
                </svg>
            `;
			const pauseIcon = `
                <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
                </svg>
            `;
			this.mobilePlayButton.innerHTML = isPaused
				? playIcon
				: pauseIcon + '<span class="sr-only">' + (isPaused ? 'Play' : 'Pause') + '</span>';
		}
	}

	toggleMute() {
		this.video.muted = !this.video.muted;
		this.updateMuteButtonIcon(this.video.muted);
		this.updateVolumeBars(this.video.muted ? 0 : this.video.volume);
	}

	updateMuteButtonIcon(isMuted) {
		const unmuteIcon = `
            <svg class="icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>
            </svg>
        `;
		const muteIcon = `
            <svg class="icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>
            </svg>
        `;

		if (!this.isTouchDevice && this.muteButton) {
			this.muteButton.innerHTML = isMuted
				? muteIcon
				: unmuteIcon + '<span class="sr-only">' + (isMuted ? 'Unmute' : 'Mute') + '</span>';
		} else if (this.isTouchDevice && this.mobileMuteButton) {
			this.mobileMuteButton.innerHTML = isMuted
				? muteIcon
				: unmuteIcon + '<span class="sr-only">' + (isMuted ? 'Unmute' : 'Mute') + '</span>';
		}
	}

	toggleFullscreen() {
		if (!document.fullscreenElement) {
			this.requestFullscreen().catch((err) => {
				console.log(`Error attempting to enable fullscreen: ${err.message}`);
			});
		} else {
			document.exitFullscreen();
		}
	}

	showControls() {
		if (!this.isTouchDevice && this.controls) {
			this.controls.classList.add('visible');
		}
	}

	hideControls() {
		if (!this.isTouchDevice && this.controls && !this.video.paused && !this.isSeeking) {
			this.controls.classList.remove('visible');
		}
	}

	handleVisibilityChange() {
		if (document.hidden) {
			this.video.pause();
		}
	}

	updateProgressBar() {
		if (!this.isTouchDevice && this.video.duration) {
			const progress = (this.video.currentTime / this.video.duration) * 100;
			this.progressBarFill.style.width = `${progress}%`;

			// Update seek handle position
			const seekHandle = this.shadowRoot.querySelector('.seek-handle');
			if (seekHandle) {
				seekHandle.style.left = `${progress}%`;
			}

			// Update time display
			const timeDisplay = this.shadowRoot.querySelector('.time-display');
			if (timeDisplay) {
				timeDisplay.textContent = `${this.formatTime(this.video.currentTime)} / ${this.formatTime(this.video.duration)}`;
			}
		}
	}

	startSeeking(e) {
		this.isSeeking = true;
		this.seeking(e);
		// Clear hide timeout while seeking
		clearTimeout(this.hideControlsTimeout);
	}

	seeking(e) {
		if (!this.isSeeking) return;

		let clientX;
		if (e.type.startsWith('touch')) {
			clientX = e.touches[0].clientX;
		} else {
			clientX = e.clientX;
		}

		const rect = this.progressBar.getBoundingClientRect();
		const position = (clientX - rect.left) / rect.width;
		const seekTime = Math.max(0, Math.min(1, position)) * this.video.duration;

		// Update progress bar immediately for smooth visual feedback
		this.progressBarFill.style.width = `${position * 100}%`;

		// Update seek handle position
		const seekHandle = this.shadowRoot.querySelector('.seek-handle');
		if (seekHandle) {
			seekHandle.style.left = `${position * 100}%`;
		}

		// Only update video time on actual seek
		this.video.currentTime = seekTime;
	}

	endSeeking() {
		this.isSeeking = false;
		// Restart the hide timeout after seeking ends
		this.showControls();
	}

	setupIntersectionObserver() {
		this.observer = new IntersectionObserver(
			(entries) => {
				entries.forEach((entry) => {
					this.isInView = entry.isIntersecting;

					if (this.isTouchDevice) {
						// Mobile behavior: auto-play when in view, pause when out of view
						if (entry.isIntersecting) {
							if (this.hasAttribute('autoplay') && !this.hasAutoPlayed) {
								this.hasAutoPlayed = true;
								this.video.play().catch(() => {
									console.log('Auto-play failed');
								});
							}
						} else {
							// Store current playing state and pause if playing
							this.wasPlaying = !this.video.paused;
							if (!this.video.paused) {
								this.video.pause();
							}
						}
					} else {
						// Desktop behavior: pause when out of view, resume if was playing
						if (!entry.isIntersecting) {
							this.wasPlaying = !this.video.paused;
							if (!this.video.paused) {
								this.video.pause();
							}
						} else if (this.wasPlaying) {
							this.video.play().catch(() => {
								console.log('Auto-resume failed');
							});
						}
					}
				});
			},
			{
				threshold: 0.2 // Trigger when 20% of the video is visible
			}
		);

		this.observer.observe(this);
	}

	disconnectedCallback() {
		if (this.observer) {
			this.observer.disconnect();
		}
	}

	handleVolumeBarClick(e) {
		if (e.target.classList.contains('volume-bar')) {
			const volume = parseFloat(e.target.dataset.volume);
			this.video.volume = volume;
			this.video.muted = false;
			this.updateMuteButtonIcon(false);
			this.updateVolumeBars(volume);
		}
	}

	updateVolumeBars(currentVolume) {
		if (!this.isTouchDevice) {
			const bars = this.shadowRoot.querySelectorAll('.volume-bar');
			bars.forEach((bar) => {
				const barVolume = parseFloat(bar.dataset.volume);
				if (barVolume <= currentVolume) {
					bar.classList.add('active');
				} else {
					bar.classList.remove('active');
				}
			});
		}
	}

	handleFullscreenChange() {
		if (!this.isTouchDevice) {
			const maximizeIcon = `
                <svg class="icon" id="fullscreenIcon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/>
                </svg>
            `;
			const minimizeIcon = `
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-minimize icon">
                    <path d="M8 3v3a2 2 0 0 1-2 2H3"/><path d="M21 8h-3a2 2 0 0 1-2-2V3"/><path d="M3 16h3a2 2 0 0 1 2 2v3"/><path d="M16 21v-3a2 2 0 0 1 2-2h3"/>
                </svg>
            `;

			this.fullscreenButton.innerHTML = document.fullscreenElement ? minimizeIcon : maximizeIcon;
			if (document.fullscreenElement) {
				this.showControls();
			}
		}
	}

	formatTime(seconds) {
		const minutes = Math.floor(seconds / 60);
		const remainingSeconds = Math.floor(seconds % 60);
		return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
	}

	setupAccessibilityFeatures() {
		if (!this.isTouchDevice) {
			// Set explicit tab order for controls
			const tabOrder = [
				this.playButton,
				this.muteButton,
				this.volumeBars,
				this.progressBar,
				this.fullscreenButton
			];

			tabOrder.forEach((element, index) => {
				if (element) {
					element.setAttribute('tabindex', index + 1);
				}
			});

			// Add ARIA labels and roles
			this.video.setAttribute('aria-label', this.getAttribute('video-title') || 'Video player');
			this.progressBar?.setAttribute('role', 'slider');
			this.progressBar?.setAttribute('aria-label', 'Progress');
			this.progressBar?.setAttribute('aria-valuemin', '0');
			this.progressBar?.setAttribute('aria-valuemax', '100');
			this.progressBar?.setAttribute('aria-valuenow', '0');
		}

		// Add keyboard controls
		this.setupKeyboardControls();
	}

	setupCaptions() {
		// Caption setup logic would go here
		// This is a placeholder for future caption functionality
	}

	setupKeyboardControls() {
		if (!this.isTouchDevice) {
			this.addEventListener('keydown', (e) => {
				switch (e.key) {
					case ' ':
						e.preventDefault();
						this.togglePlay();
						break;
					case 'm':
					case 'M':
						e.preventDefault();
						this.toggleMute();
						break;
					case 'f':
					case 'F':
						e.preventDefault();
						this.toggleFullscreen();
						break;
					case 'ArrowLeft':
						e.preventDefault();
						this.video.currentTime = Math.max(0, this.video.currentTime - 10);
						break;
					case 'ArrowRight':
						e.preventDefault();
						this.video.currentTime = Math.min(this.video.duration, this.video.currentTime + 10);
						break;
				}
			});
		}
	}
}

customElements.define('video-player', VideoPlayer);

export default VideoPlayer;
