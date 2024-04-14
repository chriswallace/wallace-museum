import { toast } from '@zerodevx/svelte-toast';

const toastThemes = {
    success: {
        '--toastBackground': '#28a745',
        '--toastBarBackground': '#155724'
    },
    error: {
        '--toastBackground': '#dc3545',
        '--toastBarBackground': '#721c24'
    },
    info: {
        '--toastBackground': '#17a2b8',
        '--toastBarBackground': '#0c5460'
    }
};

export function showToast(message, themeName) {
    const theme = toastThemes[themeName] || {};
    toast.push(message, { theme, duration: 3000 });
}