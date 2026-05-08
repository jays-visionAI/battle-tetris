/**
 * StatsManager - 전적 관리 유틸 (localStorage 기반)
 * 
 * 데이터 구조:
 * {
 *   [nickname]: {
 *     wins: number,
 *     losses: number,
 *     totalGames: number
 *   }
 * }
 */

const STORAGE_KEY = 'battle-tetris-stats';

export interface PlayerStats {
  wins: number;
  losses: number;
  totalGames: number;
}

export interface LeaderboardEntry {
  nickname: string;
  wins: number;
  losses: number;
  totalGames: number;
  winRate: number;
}

class StatsManager {
  private getAllStats(): Record<string, PlayerStats> {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return {};
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }

  private saveAllStats(stats: Record<string, PlayerStats>): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
    } catch (e) {
      console.error('[StatsManager] 저장 실패:', e);
    }
  }

  /** 특정 닉네임의 전적 조회 */
  getStats(nickname: string): PlayerStats {
    const stats = this.getAllStats();
    return stats[nickname] || { wins: 0, losses: 0, totalGames: 0 };
  }

  /** 게임 결과 기록 (승자/패자 닉네임) */
  recordGame(winnerNickname: string, loserNickname: string): void {
    const stats = this.getAllStats();

    // 승자 기록
    const winnerStats = stats[winnerNickname] || { wins: 0, losses: 0, totalGames: 0 };
    winnerStats.wins += 1;
    winnerStats.totalGames += 1;
    stats[winnerNickname] = winnerStats;

    // 패자 기록
    const loserStats = stats[loserNickname] || { wins: 0, losses: 0, totalGames: 0 };
    loserStats.losses += 1;
    loserStats.totalGames += 1;
    stats[loserNickname] = loserStats;

    this.saveAllStats(stats);
  }

  /** 승률 계산 (0-100) */
  getWinRate(nickname: string): number {
    const stats = this.getStats(nickname);
    if (stats.totalGames === 0) return 0;
    return Math.round((stats.wins / stats.totalGames) * 100);
  }

  /** 리더보드 데이터 (승률 기준 정렬, 상위 N명) */
  getLeaderboard(topN: number = 10): LeaderboardEntry[] {
    const stats = this.getAllStats();
    const entries: LeaderboardEntry[] = Object.entries(stats)
      .map(([nickname, s]) => ({
        nickname,
        wins: s.wins,
        losses: s.losses,
        totalGames: s.totalGames,
        winRate: s.totalGames > 0 ? Math.round((s.wins / s.totalGames) * 100) : 0,
      }))
      .sort((a, b) => {
        // 승률 내림차순
        if (b.winRate !== a.winRate) return b.winRate - a.winRate;
        // 동률 시 승수 내림차순
        if (b.wins !== a.wins) return b.wins - a.wins;
        // 동률 시 총 게임 수 내림차순
        return b.totalGames - a.totalGames;
      });

    return entries.slice(0, topN);
  }
}

export const statsManager = new StatsManager();
