import { useState, useEffect } from 'react';
import { statsManager, LeaderboardEntry } from '../utils/StatsManager';

interface LeaderboardProps {
  onBack: () => void;
}

export default function Leaderboard({ onBack }: LeaderboardProps) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);

  useEffect(() => {
    setEntries(statsManager.getLeaderboard(10));
  }, []);

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <button style={styles.backButton} onClick={onBack}>
          ← 로비로
        </button>
        <h1 style={styles.title}>🏆 리더보드</h1>
      </div>

      <div style={styles.tableContainer}>
        {entries.length === 0 ? (
          <div style={styles.empty}>
            <p style={styles.emptyIcon}>📊</p>
            <p style={styles.emptyText}>아직 기록된 전적이 없습니다.</p>
            <p style={styles.emptyHint}>게임을 플레이하면 여기에 랭킹이 표시됩니다!</p>
          </div>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr style={styles.tableHeaderRow}>
                <th style={styles.th}>순위</th>
                <th style={styles.th}>닉네임</th>
                <th style={styles.th}>승</th>
                <th style={styles.th}>패</th>
                <th style={styles.th}>승률</th>
                <th style={styles.th}>총 게임</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry, index) => (
                <tr
                  key={entry.nickname}
                  style={{
                    ...styles.tr,
                    backgroundColor: index === 0 ? 'rgba(255, 215, 0, 0.1)' : 
                                    index === 1 ? 'rgba(192, 192, 192, 0.08)' : 
                                    index === 2 ? 'rgba(205, 127, 50, 0.06)' : 
                                    'transparent',
                  }}
                >
                  <td style={styles.td}>
                    {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`}
                  </td>
                  <td style={{ ...styles.td, fontWeight: 'bold', color: '#00ffff' }}>
                    {entry.nickname}
                  </td>
                  <td style={{ ...styles.td, color: '#00ff00' }}>{entry.wins}</td>
                  <td style={{ ...styles.td, color: '#ff4444' }}>{entry.losses}</td>
                  <td style={{
                    ...styles.td,
                    color: entry.winRate >= 50 ? '#00ff00' : '#ffaa00',
                    fontWeight: 'bold',
                  }}>
                    {entry.winRate}%
                  </td>
                  <td style={styles.td}>{entry.totalGames}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div style={styles.footer}>
        <button style={styles.backButtonLarge} onClick={onBack}>
          ← 로비로 돌아가기
        </button>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    minHeight: '100vh',
    backgroundColor: '#0a0a1a',
    color: '#fff',
    fontFamily: 'Arial, sans-serif',
    padding: '20px',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '20px',
    marginBottom: '30px',
    width: '100%',
    maxWidth: '600px',
  },
  backButton: {
    padding: '8px 16px',
    fontSize: '14px',
    backgroundColor: '#333',
    color: '#fff',
    border: '1px solid #555',
    borderRadius: '8px',
    cursor: 'pointer',
  },
  title: {
    fontSize: '36px',
    fontWeight: 'bold',
    color: '#00ffff',
    textShadow: '0 0 20px rgba(0, 255, 255, 0.5)',
    margin: 0,
    flex: 1,
    textAlign: 'center',
  },
  tableContainer: {
    width: '100%',
    maxWidth: '600px',
    backgroundColor: '#1a1a2e',
    borderRadius: '12px',
    padding: '20px',
    border: '1px solid #333',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
  },
  tableHeaderRow: {
    borderBottom: '2px solid #00ffff',
  },
  th: {
    padding: '12px 8px',
    textAlign: 'center',
    fontSize: '13px',
    color: '#888',
    fontWeight: 'bold',
    textTransform: 'uppercase' as const,
  },
  tr: {
    borderBottom: '1px solid #222',
    transition: 'background-color 0.2s',
  },
  td: {
    padding: '12px 8px',
    textAlign: 'center',
    fontSize: '14px',
  },
  empty: {
    textAlign: 'center',
    padding: '40px 20px',
  },
  emptyIcon: {
    fontSize: '48px',
    marginBottom: '16px',
  },
  emptyText: {
    fontSize: '18px',
    color: '#888',
    marginBottom: '8px',
  },
  emptyHint: {
    fontSize: '14px',
    color: '#555',
  },
  footer: {
    marginTop: '30px',
  },
  backButtonLarge: {
    padding: '12px 32px',
    fontSize: '16px',
    backgroundColor: '#333',
    color: '#fff',
    border: '1px solid #555',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: 'bold',
  },
};
