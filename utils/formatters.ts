/**
 * Formats a raw phone number string into +1 (XXX) XXX-XXXX
 * @param value Raw string input from user
 * @returns Formatted string
 */
export const formatPhoneNumber = (value: string): string => {
    // Remove all non-numeric characters
    const digits = value.replace(/\D/g, '');

    // If it starts with 1, it's the US prefix, we care about what comes after
    let cleaned = digits;
    if (digits.startsWith('1')) {
        cleaned = digits.substring(1);
    }

    // Limit to 10 digits for the actual number
    const limited = cleaned.substring(0, 10);
    const length = limited.length;

    if (length === 0) return '+1 ';
    if (length <= 3) return `+1 (${limited}`;
    if (length <= 6) return `+1 (${limited.substring(0, 3)}) ${limited.substring(3)}`;
    return `+1 (${limited.substring(0, 3)}) ${limited.substring(3, 6)}-${limited.substring(6, 10)}`;
};

/**
 * Parses duration strings like "45 min", "1.5 hours", "2-3 hours", "5+ hours" into total minutes.
 * @param durationStr String from servicePackages or serviceAddons
 * @returns number of minutes
 */
export const parseDurationToMinutes = (durationStr: string): number => {
    if (!durationStr) return 15; // Safe default

    const lower = durationStr.toLowerCase().trim();

    // Handle "min" or "mins"
    if (lower.includes('min')) {
        const num = parseInt(lower.match(/\d+/)?. [0] || '15');
        return isNaN(num) ? 15 : num;
    }

    // Handle "hour" or "hours"
    if (lower.includes('hour')) {
        // Handle ranges like "4-6 hours" -> take the upper bound
        if (lower.includes('-')) {
            const parts = lower.match(/\d+/g);
            if (parts && parts.length > 1) {
                return parseInt(parts[1]) * 60;
            }
        }

        // Handle "5+ hours"
        if (lower.includes('+')) {
            const num = parseInt(lower.match(/\d+/)?. [0] || '5');
            return num * 60;
        }

        // Handle decimals like "1.5 hours"
        const num = parseFloat(lower.match(/[\d.]+/)?. [0] || '1');
        return isNaN(num) ? 60 : Math.round(num * 60);
    }

    return 15; // Fallback
};
