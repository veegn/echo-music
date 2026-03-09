import React, { useState, useEffect, useRef } from 'react';
import { LyricLine } from '../types';

function parseLyrics(lrc: string): LyricLine[] {
    if (!lrc) return [];
    const lines = lrc.split('\n');
    const result: LyricLine[] = [];
    const timeReg = /\[(\d{2}):(\d{2})(?:\.(\d{2,3}))?\]/;

    for (const line of lines) {
        const match = timeReg.exec(line);
        if (match) {
            const minutes = parseInt(match[1], 10);
            const seconds = parseInt(match[2], 10);
            const milliseconds = match[3] ? parseInt(match[3].padEnd(3, '0'), 10) : 0;
            const time = minutes * 60 + seconds + milliseconds / 1000;
            const text = line.replace(timeReg, '').trim();
            if (text) {
                result.push({ time, text });
            }
        }
    }
    return result;
}

export default function Lyrics({ songmid, currentTime }: { songmid: string; currentTime: number }) {
    const [lyrics, setLyrics] = useState<LyricLine[]>([]);
    const [loading, setLoading] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!songmid) {
            setLyrics([]);
            return;
        }
        setLoading(true);
        fetch(`/api/qqmusic/lyric?songmid=${songmid}`)
            .then(res => res.json())
            .then(data => {
                if (data.lyric) {
                    setLyrics(parseLyrics(data.lyric));
                } else {
                    setLyrics([]);
                }
            })
            .catch(err => console.error('[Lyrics] 歌词加载失败:', err))
            .finally(() => setLoading(false));
    }, [songmid]);

    const activeIndex = lyrics.findIndex((line, i) => {
        const nextLine = lyrics[i + 1];
        return line.time <= currentTime && (!nextLine || nextLine.time > currentTime);
    });

    useEffect(() => {
        if (activeIndex !== -1 && scrollRef.current && containerRef.current) {
            const activeEl = scrollRef.current.children[activeIndex] as HTMLElement;
            if (activeEl) {
                const containerHeight = containerRef.current.clientHeight;
                const activeTop = activeEl.offsetTop;
                const activeHeight = activeEl.clientHeight;
                containerRef.current.scrollTo({
                    top: activeTop - containerHeight / 2 + activeHeight / 2,
                    behavior: 'smooth',
                });
            }
        }
    }, [activeIndex]);

    if (loading) return <div className="text-zinc-500 text-sm h-32 flex items-center justify-center">加载歌词...</div>;
    if (lyrics.length === 0) return <div className="text-zinc-500 text-sm h-32 flex items-center justify-center">暂无歌词</div>;

    return (
        <div
            className="h-48 w-full px-4 relative mb-8 group overflow-hidden"
            style={{
                maskImage: 'linear-gradient(to bottom, transparent, black 20%, black 80%, transparent)',
                WebkitMaskImage: 'linear-gradient(to bottom, transparent, black 20%, black 80%, transparent)'
            }}
        >
            <div
                className="overflow-y-auto h-full scroll-smooth"
                ref={containerRef}
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
                {/* Hide scrollbar for Chrome/Safari using Tailwind via separate css or inline pseudo is hard, using scrollbar-hide plugin or basic inline styles */}
                <style>{`
                    .lyrics-container::-webkit-scrollbar { display: none; }
                `}</style>
                <div className="py-20 space-y-6 text-center lyrics-container" ref={scrollRef}>
                    {lyrics.map((line, i) => (
                        <div
                            key={i}
                            className={`transition-all duration-500 cursor-pointer ${i === activeIndex
                                ? 'text-white font-bold text-lg scale-110 opacity-100 drop-shadow-[0_0_10px_rgba(255,255,255,0.3)]'
                                : 'text-zinc-400/80 text-sm hover:text-white/80 opacity-60 hover:scale-105'
                                }`}
                        >
                            {line.text}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
