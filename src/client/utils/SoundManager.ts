// Battle Tetris - Sound Manager
class SoundManager {
  private bgm: HTMLAudioElement | null = null;
  private attackSend: HTMLAudioElement | null = null;
  private attackReceive: HTMLAudioElement | null = null;
  private isInitialized: boolean = false;
  private isMuted: boolean = false;

  constructor() {
    this.init();
  }

  private init() {
    try {
      // BGM 초기화
      this.bgm = new Audio('/tetris-bgm.mp3');
      this.bgm.loop = true;
      this.bgm.volume = 0.3;
      
      // 효과음 초기화
      this.attackSend = new Audio('/attack-send.mp3');
      this.attackSend.volume = 0.7;
      
      this.attackReceive = new Audio('/attack-receive.mp3');
      this.attackReceive.volume = 0.8;

      // 로드 이벤트 처리
      const sounds = [this.bgm, this.attackSend, this.attackReceive];
      let loadedCount = 0;

      sounds.forEach(sound => {
        sound.addEventListener('canplaythrough', () => {
          loadedCount++;
          if (loadedCount === sounds.length) {
            this.isInitialized = true;
            console.log('🎵 Sound Manager initialized');
          }
        });

        sound.addEventListener('error', (e) => {
          console.warn(`⚠️ Sound load failed: ${sound.src}`, e);
        });
      });

    } catch (error) {
      console.warn('⚠️ Sound Manager initialization failed:', error);
    }
  }

  // 사용자 첫 상호작용 후 BGM 시작
  async startBGM() {
    if (this.isMuted) return;
    
    // MP3 파일이 있으면 사용, 없으면 Web Audio API로 대체
    if (this.bgm) {
      try {
        this.bgm.currentTime = 0;
        await this.bgm.play();
        console.log('🎵 BGM started (MP3)');
        return;
      } catch (error) {
        console.warn('⚠️ BGM MP3 play failed, trying Web Audio API:', error);
      }
    }
    
    // Web Audio API 대체 BGM
    this.startWebAudioBGM();
  }

  private startWebAudioBGM() {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      // 테트리스 스타일 멜로디
      oscillator.frequency.setValueAtTime(659.25, audioContext.currentTime); // E5
      gainNode.gain.setValueAtTime(0.05, audioContext.currentTime);
      
      oscillator.start();
      console.log('🎵 BGM started (Web Audio API)');
      
      // 10초 후 재시작 (루프)
      setTimeout(() => {
        try {
          oscillator.stop();
          audioContext.close();
          if (!this.isMuted) {
            this.startWebAudioBGM(); // 재귀적으로 재시작
          }
        } catch (e) {}
      }, 10000);
      
    } catch (error) {
      console.warn('⚠️ Web Audio BGM failed:', error);
    }
  }

  stopBGM() {
    if (this.bgm) {
      this.bgm.pause();
      this.bgm.currentTime = 0;
    }
  }

  // 공격 발동 시 효과음 (라인 수에 따른 피치 변화)
  playAttackSend(lineCount: number) {
    if (this.isMuted) return;

    // MP3 파일이 있으면 사용, 없으면 Web Audio API로 생성
    if (this.attackSend) {
      try {
        const clone = this.attackSend.cloneNode() as HTMLAudioElement;
        clone.playbackRate = 1.0 + (lineCount - 1) * 0.125;
        clone.volume = Math.min(0.7 + lineCount * 0.1, 1.0);
        clone.play().catch(() => this.createAttackSendSound(lineCount));
        return;
      } catch (error) {
        console.warn('⚠️ Attack send MP3 failed, using Web Audio:', error);
      }
    }
    
    this.createAttackSendSound(lineCount);
  }

  private createAttackSendSound(lineCount: number) {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      // 라인 수에 따른 주파수 (1줄: 523Hz, 4줄: 1046Hz)
      const frequency = 523 + (lineCount - 1) * 131;
      oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
      gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
      
      oscillator.start();
      oscillator.stop(audioContext.currentTime + 0.3);
    } catch (error) {
      console.warn('⚠️ Web Audio attack send failed:', error);
    }
  }

  // 공격 수신 시 효과음
  playAttackReceive(lineCount: number) {
    if (this.isMuted) return;

    if (this.attackReceive) {
      try {
        const clone = this.attackReceive.cloneNode() as HTMLAudioElement;
        clone.volume = Math.min(0.8 + lineCount * 0.05, 1.0);
        clone.play().catch(() => this.createAttackReceiveSound(lineCount));
        return;
      } catch (error) {
        console.warn('⚠️ Attack receive MP3 failed, using Web Audio:', error);
      }
    }
    
    this.createAttackReceiveSound(lineCount);
  }

  private createAttackReceiveSound(lineCount: number) {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      // 공격 받을 때는 낮은 주파수 (경고음)
      oscillator.frequency.setValueAtTime(220, audioContext.currentTime); // A3
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
      
      oscillator.start();
      oscillator.stop(audioContext.currentTime + 0.5);
    } catch (error) {
      console.warn('⚠️ Web Audio attack receive failed:', error);
    }
  }

  // 음소거 토글
  toggleMute() {
    this.isMuted = !this.isMuted;
    
    if (this.isMuted) {
      this.stopBGM();
    } else if (this.isInitialized) {
      this.startBGM();
    }
    
    return this.isMuted;
  }

  getMuteState() {
    return this.isMuted;
  }
}

// 전역 싱글톤 인스턴스
export const soundManager = new SoundManager();
export default soundManager;