import React, { useRef } from 'react';

interface OTPInputProps {
    value: string;
    onChange: (val: string) => void;
    isLoading?: boolean;
    onComplete?: (code: string) => void;
    label?: string;
    description?: string;
}

export const OTPInput: React.FC<OTPInputProps> = ({
    value,
    onChange,
    isLoading,
    onComplete,
    label = 'Verification Code',
    description = 'Enter the 6-digit code sent to your phone'
}) => {
    const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

    const handleChange = (index: number, val: string) => {
        const sanitized = val.replace(/\D/g, '');
        if (!sanitized) {
            // Handle backspace or empty
            const newValue = value.split('');
            newValue[index] = '';
            onChange(newValue.join(''));
            return;
        }

        const newValue = value.split('');
        newValue[index] = sanitized[0];
        const combined = newValue.join('');
        onChange(combined);

        if (combined.length === 6 && onComplete) {
            onComplete(combined);
        }

        if (index < 5 && sanitized) {
            inputRefs.current[index + 1]?.focus();
        }
    };

    const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
        if (e.key === 'Backspace' && !value[index] && index > 0) {
            inputRefs.current[index - 1]?.focus();
        }
    };

    const handlePaste = (e: React.ClipboardEvent) => {
        e.preventDefault();
        const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
        if (pastedData) {
            onChange(pastedData);
            if (pastedData.length === 6 && onComplete) {
                onComplete(pastedData);
            }
        }
    };

    return (
        <div className="mb-8">
            {label && (
                <label className="block text-xs uppercase text-slate-400 font-bold mb-4 text-center tracking-widest">
                    {label}
                </label>
            )}
            <div className="flex justify-between gap-1.5 sm:gap-2 md:gap-3" onPaste={handlePaste}>
                {[0, 1, 2, 3, 4, 5].map((i) => (
                    <input
                        key={i}
                        ref={(el) => { inputRefs.current[i] = el; }}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={value[i] || ''}
                        onChange={(e) => handleChange(i, e.target.value)}
                        onKeyDown={(e) => handleKeyDown(i, e)}
                        className={`w-full h-12 xs:h-14 md:h-16 bg-white/5 border-2 rounded-xl text-center text-xl xs:text-2xl font-bold text-white focus:outline-none transition-all ${value[i] ? 'border-primary shadow-[0_0_15px_rgba(59,130,246,0.2)]' : 'border-white/10 focus:border-primary/50'
                            }`}
                        disabled={isLoading}
                    />
                ))}
            </div>
            {description && (
                <p className="mt-4 text-xs text-slate-500 text-center animate-fade-in">
                    {description}
                </p>
            )}
        </div>
    );
};
