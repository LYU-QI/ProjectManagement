import React from 'react';

export type BadgeVariant = 'success' | 'warning' | 'error' | 'info' | 'neutral' | 'ai';

interface StatusBadgeProps {
    label: string;
    variant?: BadgeVariant;
    pulse?: boolean;
}

export default function StatusBadge({ label, variant = 'neutral', pulse = false }: StatusBadgeProps) {
    let colorVar = '--text-muted';

    switch (variant) {
        case 'success':
            colorVar = '--glow-green';
            break;
        case 'warning':
            colorVar = '--glow-alert';
            break;
        case 'error':
            colorVar = '--glow-red';
            break;
        case 'info':
            colorVar = '--glow-blue';
            break;
        case 'ai':
            colorVar = '--glow-purple';
            break;
        default:
            colorVar = '--text-muted';
    }

    const badgeStyle = {
        color: `var(${colorVar})`,
        backgroundColor: `color-mix(in srgb, var(${colorVar}) 10%, transparent)`,
        border: `1px solid color-mix(in srgb, var(${colorVar}) 30%, transparent)`,
        boxShadow: pulse ? `0 0 10px color-mix(in srgb, var(${colorVar}) 40%, transparent)` : 'none',
    };

    const dotStyle = {
        backgroundColor: `var(${colorVar})`,
        boxShadow: `0 0 8px var(${colorVar})`,
    };

    return (
        <span
            style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 10px',
                borderRadius: '20px',
                fontSize: '12px',
                fontWeight: 600,
                ...badgeStyle
            }}
        >
            <span
                style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    ...dotStyle
                }}
                className={pulse ? 'pulse-anim' : ''}
            />
            {label}
            {pulse && (
                <style>
                    {`
            @keyframes dotPulse {
              0% { opacity: 0.6; transform: scale(0.9); }
              50% { opacity: 1; transform: scale(1.2); }
              100% { opacity: 0.6; transform: scale(0.9); }
            }
            .pulse-anim {
              animation: dotPulse 2s infinite ease-in-out;
            }
          `}
                </style>
            )}
        </span>
    );
}
