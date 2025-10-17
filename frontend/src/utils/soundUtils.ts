// Sound utilities for notification sounds
// Uses Web Audio API to generate notification sounds

export class SoundUtils {
    private static audioContext: AudioContext | null = null;
    private static hasUserInteracted: boolean = false;
    private static isInitialized: boolean = false;
    private static audioPermissionStatus: 'unknown' | 'granted' | 'denied' | 'blocked' = 'unknown';
    private static browserInfo: {
        name: string;
        version: string;
        supportsWebAudio: boolean;
        autoplayPolicy: 'allowed' | 'restricted' | 'blocked';
        requiresUserGesture: boolean;
        supportsAudioContext: boolean;
    } | null = null;
    private static isPlaying: boolean = false;

    // Detect browser capabilities and autoplay policies
    private static detectBrowser(): {
        name: string;
        version: string;
        supportsWebAudio: boolean;
        autoplayPolicy: 'allowed' | 'restricted' | 'blocked';
        requiresUserGesture: boolean;
        supportsAudioContext: boolean;
    } {
        if (this.browserInfo) return this.browserInfo;

        const userAgent = navigator.userAgent;
        let name = 'Unknown';
        let version = 'Unknown';
        let supportsWebAudio = !!(window.AudioContext || (window as any).webkitAudioContext);
        let supportsAudioContext = supportsWebAudio;
        let autoplayPolicy: 'allowed' | 'restricted' | 'blocked' = 'restricted';
        let requiresUserGesture = true;

        // Detect browser and set specific policies
        if (userAgent.includes('Chrome')) {
            name = 'Chrome';
            const match = userAgent.match(/Chrome\/(\d+)/);
            version = match ? match[1] : 'Unknown';
            const versionNum = parseInt(version);

            // Chrome autoplay policy changes
            if (versionNum >= 66) {
                autoplayPolicy = 'blocked';
                requiresUserGesture = true;
            } else if (versionNum >= 64) {
                autoplayPolicy = 'restricted';
                requiresUserGesture = true;
            } else {
                autoplayPolicy = 'allowed';
                requiresUserGesture = false;
            }
        } else if (userAgent.includes('Firefox')) {
            name = 'Firefox';
            const match = userAgent.match(/Firefox\/(\d+)/);
            version = match ? match[1] : 'Unknown';
            const versionNum = parseInt(version);

            // Firefox autoplay policy
            if (versionNum >= 69) {
                autoplayPolicy = 'restricted';
                requiresUserGesture = true;
            } else {
                autoplayPolicy = 'allowed';
                requiresUserGesture = false;
            }
        } else if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) {
            name = 'Safari';
            const match = userAgent.match(/Version\/(\d+)/);
            version = match ? match[1] : 'Unknown';
            const versionNum = parseInt(version);

            // Safari has the most restrictive autoplay policy
            autoplayPolicy = 'blocked';
            requiresUserGesture = true;

            // Safari has limited Web Audio API support
            if (versionNum < 14) {
                supportsAudioContext = false;
            }
        } else if (userAgent.includes('Edge')) {
            name = 'Edge';
            const match = userAgent.match(/Edge\/(\d+)/);
            version = match ? match[1] : 'Unknown';
            const versionNum = parseInt(version);

            // Edge autoplay policy (similar to Chrome)
            if (versionNum >= 79) { // Chromium-based Edge
                autoplayPolicy = 'blocked';
                requiresUserGesture = true;
            } else {
                autoplayPolicy = 'restricted';
                requiresUserGesture = true;
            }
        }

        this.browserInfo = {
            name,
            version,
            supportsWebAudio,
            autoplayPolicy,
            requiresUserGesture,
            supportsAudioContext
        };

        console.log(`🔊 Browser detected: ${name} ${version}`);
        console.log(`🔊 Web Audio API: ${supportsWebAudio ? 'Supported' : 'Not Supported'}`);
        console.log(`🔊 Autoplay Policy: ${autoplayPolicy}`);
        console.log(`🔊 Requires User Gesture: ${requiresUserGesture}`);

        return this.browserInfo;
    }

    // Initialize audio context on first user interaction (browser-specific)
    private static initializeAudioContext(): void {
        if (this.isInitialized) return;

        const browser = this.detectBrowser();

        try {
            // Browser-specific initialization
            if (browser.name === 'Safari' && !browser.supportsAudioContext) {
                console.log('🔊 Safari detected with limited Web Audio API support - using fallback');
                this.audioPermissionStatus = 'granted';
                this.isInitialized = true;
                return;
            }

            // Try to create audio context
            this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();

            // Browser-specific post-initialization
            if (browser.name === 'Safari') {
                // Safari requires immediate resume
                this.audioContext.resume().then(() => {
                    console.log('🔊 Safari audio context resumed');
                }).catch(error => {
                    console.warn('🔊 Safari audio context resume failed:', error);
                });
            }

            this.isInitialized = true;
            this.audioPermissionStatus = 'granted';
            console.log(`🔊 Audio context initialized successfully on ${browser.name} ${browser.version}`);
        } catch (error) {
            console.error('Failed to initialize audio context:', error);
            this.audioPermissionStatus = 'blocked';
        }
    }

    // Check if user has interacted and audio is ready
    private static isAudioReady(): boolean {
        return this.hasUserInteracted && this.isInitialized && this.audioContext !== null;
    }

    // Mark that user has interacted (call this on any user interaction)
    public static markUserInteraction(): void {
        if (!this.hasUserInteracted) {
            this.hasUserInteracted = true;
            this.initializeAudioContext();
            console.log('🔊 User interaction detected, audio system ready');
        }
    }

    // Get audio system status for user feedback
    public static getAudioStatus(): {
        isReady: boolean;
        hasInteracted: boolean;
        isInitialized: boolean;
        permissionStatus: string;
        message: string;
        browserInfo: {
            name: string;
            version: string;
            supportsWebAudio: boolean;
            autoplayPolicy: 'allowed' | 'restricted' | 'blocked';
            requiresUserGesture: boolean;
            supportsAudioContext: boolean;
        };
    } {
        const isReady = this.isAudioReady();
        const browser = this.detectBrowser();
        let message = '';

        if (!this.hasUserInteracted) {
            if (browser.requiresUserGesture) {
                message = `Click anywhere on the page to enable notification sounds (required by ${browser.name})`;
            } else {
                message = 'Click anywhere on the page to enable notification sounds';
            }
        } else if (browser.autoplayPolicy === 'blocked') {
            message = `${browser.name} blocks autoplay - sounds will work after user interaction`;
        } else if (!browser.supportsWebAudio) {
            message = `Web Audio API not supported in ${browser.name} - using fallback sounds`;
        } else if (browser.name === 'Safari' && !browser.supportsAudioContext) {
            message = `Safari ${browser.version} has limited audio support - using fallback sounds`;
        } else if (!this.isInitialized) {
            message = 'Audio system failed to initialize - sounds may not work';
        } else if (this.audioPermissionStatus === 'blocked') {
            message = 'Audio is blocked by browser - check browser settings';
        } else if (isReady) {
            message = 'Notification sounds are ready and working';
        } else {
            message = 'Audio system is initializing...';
        }

        return {
            isReady,
            hasInteracted: this.hasUserInteracted,
            isInitialized: this.isInitialized,
            permissionStatus: this.audioPermissionStatus,
            message,
            browserInfo: browser
        };
    }

    // Test notification sound (for user to verify audio is working)
    public static async testNotificationSound(): Promise<boolean> {
        try {
            await this.playNotificationSound();
            console.log('🔊 Test notification sound played successfully');
            return true;
        } catch (error) {
            console.error('Test notification sound failed:', error);
            return false;
        }
    }

    // Initialize audio context (required for Web Audio API)
    private static getAudioContext(): AudioContext {
        if (!this.audioContext) {
            this.initializeAudioContext();
        }
        return this.audioContext!;
    }

    // Play a simple notification beep sound
    static async playNotificationSound(): Promise<void> {
        // Prevent overlapping sounds
        if (this.isPlaying) {
            return;
        }
        this.isPlaying = true;

        // Check if audio is ready to play
        if (!this.isAudioReady()) {
            this.playFallbackSound();
            // Reset flag after a short delay for fallback
            setTimeout(() => {
                this.isPlaying = false;
            }, 300);
            return;
        }

        try {
            const audioContext = this.getAudioContext();

            // Resume audio context if it's suspended (required by some browsers)
            if (audioContext.state === 'suspended') {
                await audioContext.resume();
            }

            // Create oscillator for the beep sound
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();

            // Connect nodes
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);

            // Configure the sound
            oscillator.frequency.setValueAtTime(1000, audioContext.currentTime); // 1000Hz frequency
            oscillator.type = 'sine';

            // Configure volume envelope (fade in/out)
            gainNode.gain.setValueAtTime(0, audioContext.currentTime);
            gainNode.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + 0.01);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);

            // Play the sound
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.3);

            // Reset flag after sound completes
            setTimeout(() => {
                this.isPlaying = false;
            }, 300);
        } catch (error) {
            this.handleAudioError(error);
            // Fallback: try to play a simple beep using HTML5 Audio
            this.playFallbackSound();
            // Reset flag after fallback attempt
            setTimeout(() => {
                this.isPlaying = false;
            }, 300);
        }
    }

    // Fallback sound using HTML5 Audio (browser-specific strategies)
    private static playFallbackSound(): void {
        const browser = this.detectBrowser();

        // Browser-specific fallback strategies
        let fallbackStrategies: (() => Promise<void>)[] = [];

        if (browser.name === 'Safari') {
            // Safari-specific strategies (most restrictive)
            fallbackStrategies = [
                () => this.playSafariCompatibleBeep(),
                () => this.playSimpleTone(),
                () => this.playSystemBeep()
            ];
        } else if (browser.name === 'Firefox') {
            // Firefox-specific strategies
            fallbackStrategies = [
                () => this.playBase64Beep(),
                () => this.playDataURLBeep(),
                () => this.playSystemBeep(),
                () => this.playSimpleTone()
            ];
        } else if (browser.name === 'Chrome' || browser.name === 'Edge') {
            // Chrome/Edge strategies
            fallbackStrategies = [
                () => this.playDataURLBeep(),
                () => this.playBase64Beep(),
                () => this.playSystemBeep(),
                () => this.playSimpleTone()
            ];
        } else {
            // Generic fallback strategies
            fallbackStrategies = [
                () => this.playDataURLBeep(),
                () => this.playBase64Beep(),
                () => this.playSystemBeep(),
                () => this.playSimpleTone()
            ];
        }

        let strategyIndex = 0;

        const tryNextStrategy = () => {
            if (strategyIndex >= fallbackStrategies.length) {
                return;
            }

            try {
                fallbackStrategies[strategyIndex]()
                    .then(() => {
                        // Sound played successfully - minimal logging
                    })
                    .catch(() => {
                        strategyIndex++;
                        tryNextStrategy();
                    });
            } catch (error) {
                strategyIndex++;
                tryNextStrategy();
            }
        };

        tryNextStrategy();
    }

    // Handle audio errors with specific user-friendly messages
    private static handleAudioError(error: any): void {
        let errorMessage = 'Audio playback failed';

        if (error.name === 'NotAllowedError') {
            errorMessage = 'Audio is blocked by browser autoplay policy';
            this.audioPermissionStatus = 'blocked';
        } else if (error.name === 'NotSupportedError') {
            errorMessage = 'Audio format not supported by browser';
        } else if (error.name === 'AbortError') {
            errorMessage = 'Audio playback was interrupted';
        }

        console.warn(`🔊 ${errorMessage}:`, error);
    }

    // Fallback Strategy 1: Data URL beep (original method)
    private static async playDataURLBeep(): Promise<void> {
        const audioData = this.generateBeepDataURL();
        const audio = new Audio(audioData);
        audio.volume = 0.3;
        await audio.play();
    }

    // Fallback Strategy 2: Base64 encoded beep
    private static async playBase64Beep(): Promise<void> {
        const base64Audio = this.generateBase64Beep();
        const audio = new Audio(base64Audio);
        audio.volume = 0.3;
        await audio.play();
    }

    // Fallback Strategy 3: System beep using HTML5 Audio with minimal data
    private static async playSystemBeep(): Promise<void> {
        // Create a very simple beep using a minimal WAV file
        const simpleBeep = this.generateSimpleBeep();
        const audio = new Audio(simpleBeep);
        audio.volume = 0.2;
        await audio.play();
    }

    // Fallback Strategy 4: Simple tone using HTML5 Audio
    private static async playSimpleTone(): Promise<void> {
        // Last resort: try to play a very basic audio file
        const audio = new Audio();
        audio.volume = 0.1;

        // Create a simple data URL with minimal audio data
        const minimalAudio = 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIG2m98OScTgwOUarm7blmGgU7k9n1unEiBC13yO/eizEIHWq+8+OWT';

        audio.src = minimalAudio;
        await audio.play();
    }

    // Safari-specific beep (optimized for Safari's audio restrictions)
    private static async playSafariCompatibleBeep(): Promise<void> {
        // Safari requires very specific audio format and handling
        const audio = new Audio();
        audio.volume = 0.2;
        audio.preload = 'auto';

        // Create Safari-compatible minimal WAV
        const safariBeep = this.generateSafariCompatibleBeep();
        audio.src = safariBeep;

        // Safari-specific event handling
        audio.addEventListener('canplaythrough', () => {
            audio.play().catch(error => {
                console.warn('Safari audio play failed:', error);
            });
        });

        // Fallback: try to play immediately
        try {
            await audio.play();
        } catch (error) {
            console.warn('Safari immediate play failed:', error);
        }
    }

    // Generate Safari-compatible beep
    private static generateSafariCompatibleBeep(): string {
        // Ultra-minimal WAV optimized for Safari
        const samples = 500; // Very short for Safari
        const buffer = new ArrayBuffer(44 + samples * 2);
        const view = new DataView(buffer);

        // Safari-compatible WAV header
        const writeString = (offset: number, string: string) => {
            for (let i = 0; i < string.length; i++) {
                view.setUint8(offset + i, string.charCodeAt(i));
            }
        };

        writeString(0, 'RIFF');
        view.setUint32(4, 36 + samples * 2, true);
        writeString(8, 'WAVE');
        writeString(12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true);
        view.setUint16(22, 1, true);
        view.setUint32(24, 8000, true); // Low sample rate for Safari
        view.setUint32(28, 16000, true);
        view.setUint16(32, 2, true);
        view.setUint16(34, 16, true);
        writeString(36, 'data');
        view.setUint32(40, samples * 2, true);

        // Simple sine wave for Safari
        for (let i = 0; i < samples; i++) {
            const sample = Math.sin(2 * Math.PI * 800 * i / 8000) * 0.1; // Very quiet
            view.setInt16(44 + i * 2, sample * 32767, true);
        }

        const blob = new Blob([buffer], { type: 'audio/wav' });
        return URL.createObjectURL(blob);
    }

    // Generate a simple beep sound as data URL
    private static generateBeepDataURL(): string {
        // This creates a very short beep sound using Web Audio API and converts it to data URL
        // For simplicity, we'll use a basic approach
        const sampleRate = 44100;
        const duration = 0.3;
        const frequency = 800;
        const samples = Math.floor(sampleRate * duration);
        const buffer = new ArrayBuffer(44 + samples * 2);
        const view = new DataView(buffer);

        // WAV header
        const writeString = (offset: number, string: string) => {
            for (let i = 0; i < string.length; i++) {
                view.setUint8(offset + i, string.charCodeAt(i));
            }
        };

        writeString(0, 'RIFF');
        view.setUint32(4, 36 + samples * 2, true);
        writeString(8, 'WAVE');
        writeString(12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true);
        view.setUint16(22, 1, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * 2, true);
        view.setUint16(32, 2, true);
        view.setUint16(34, 16, true);
        writeString(36, 'data');
        view.setUint32(40, samples * 2, true);

        // Generate sine wave
        for (let i = 0; i < samples; i++) {
            const sample = Math.sin(2 * Math.PI * frequency * i / sampleRate) * 0.3;
            view.setInt16(44 + i * 2, sample * 32767, true);
        }

        const blob = new Blob([buffer], { type: 'audio/wav' });
        return URL.createObjectURL(blob);
    }

    // Generate Base64 encoded beep sound
    private static generateBase64Beep(): string {
        const sampleRate = 22050; // Lower sample rate for smaller file
        const duration = 0.2; // Shorter duration
        const frequency = 800;
        const samples = Math.floor(sampleRate * duration);
        const buffer = new ArrayBuffer(44 + samples * 2);
        const view = new DataView(buffer);

        // WAV header (same as before but optimized)
        const writeString = (offset: number, string: string) => {
            for (let i = 0; i < string.length; i++) {
                view.setUint8(offset + i, string.charCodeAt(i));
            }
        };

        writeString(0, 'RIFF');
        view.setUint32(4, 36 + samples * 2, true);
        writeString(8, 'WAVE');
        writeString(12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true);
        view.setUint16(22, 1, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * 2, true);
        view.setUint16(32, 2, true);
        view.setUint16(34, 16, true);
        writeString(36, 'data');
        view.setUint32(40, samples * 2, true);

        // Generate sine wave with envelope
        for (let i = 0; i < samples; i++) {
            const t = i / sampleRate;
            const envelope = Math.exp(-t * 8); // Exponential decay
            const sample = Math.sin(2 * Math.PI * frequency * t) * envelope * 0.2;
            view.setInt16(44 + i * 2, sample * 32767, true);
        }

        // Convert to base64
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        const base64 = btoa(binary);
        return `data:audio/wav;base64,${base64}`;
    }

    // Generate a very simple beep (minimal WAV)
    private static generateSimpleBeep(): string {
        // Ultra-minimal WAV file - just a few samples
        const samples = 1000; // Very short
        const buffer = new ArrayBuffer(44 + samples * 2);
        const view = new DataView(buffer);

        // Minimal WAV header
        const writeString = (offset: number, string: string) => {
            for (let i = 0; i < string.length; i++) {
                view.setUint8(offset + i, string.charCodeAt(i));
            }
        };

        writeString(0, 'RIFF');
        view.setUint32(4, 36 + samples * 2, true);
        writeString(8, 'WAVE');
        writeString(12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true);
        view.setUint16(22, 1, true);
        view.setUint32(24, 8000, true); // Low sample rate
        view.setUint32(28, 16000, true);
        view.setUint16(32, 2, true);
        view.setUint16(34, 16, true);
        writeString(36, 'data');
        view.setUint32(40, samples * 2, true);

        // Simple square wave
        for (let i = 0; i < samples; i++) {
            const sample = (i % 20 < 10) ? 0.1 : -0.1; // Square wave
            view.setInt16(44 + i * 2, sample * 32767, true);
        }

        const blob = new Blob([buffer], { type: 'audio/wav' });
        return URL.createObjectURL(blob);
    }

    // Play a different sound for different notification types
    static async playNotificationSoundByType(): Promise<void> {
        // Use the same sound for all types to match the test sound
        await this.playNotificationSound();
    }

    // Play a message notification sound (slightly different frequency)
    static async playMessageSound(): Promise<void> {
        // Check if audio is ready to play
        if (!this.isAudioReady()) {
            this.playFallbackSound();
            return;
        }

        try {
            const audioContext = this.getAudioContext();

            if (audioContext.state === 'suspended') {
                await audioContext.resume();
            }

            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);

            // Different frequency for messages (1000Hz to match general notifications)
            oscillator.frequency.setValueAtTime(300, audioContext.currentTime);
            oscillator.type = 'sine';

            gainNode.gain.setValueAtTime(0, audioContext.currentTime);
            gainNode.gain.linearRampToValueAtTime(0.25, audioContext.currentTime + 0.01);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.25);

            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.25);
        } catch (error) {
            this.handleAudioError(error);
            this.playFallbackSound();
        }
    }

    // Play a claim notification sound (different pattern)
    static async playClaimSound(): Promise<void> {
        // Check if audio is ready to play
        if (!this.isAudioReady()) {
            this.playFallbackSound();
            return;
        }

        try {
            const audioContext = this.getAudioContext();

            if (audioContext.state === 'suspended') {
                await audioContext.resume();
            }

            // Play two quick beeps for claim notifications
            for (let i = 0; i < 2; i++) {
                setTimeout(async () => {
                    const oscillator = audioContext.createOscillator();
                    const gainNode = audioContext.createGain();

                    oscillator.connect(gainNode);
                    gainNode.connect(audioContext.destination);

                    oscillator.frequency.setValueAtTime(1000, audioContext.currentTime);
                    oscillator.type = 'sine';

                    gainNode.gain.setValueAtTime(0, audioContext.currentTime);
                    gainNode.gain.linearRampToValueAtTime(0.2, audioContext.currentTime + 0.01);
                    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.15);

                    oscillator.start(audioContext.currentTime);
                    oscillator.stop(audioContext.currentTime + 0.15);
                }, i * 200);
            }
        } catch (error) {
            this.handleAudioError(error);
            this.playFallbackSound();
        }
    }
}
