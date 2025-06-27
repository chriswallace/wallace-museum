import { toast } from '@zerodevx/svelte-toast';

const toastThemes = {
	success: {
		'--toastBackground': '#10b981',
		'--toastColor': '#ffffff',
		'--toastBarBackground': '#059669',
		'--toastBorderRadius': '8px',
		'--toastBoxShadow': '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
		'--toastBorder': '1px solid #10b981'
	},
	error: {
		'--toastBackground': '#ef4444',
		'--toastColor': '#ffffff',
		'--toastBarBackground': '#dc2626',
		'--toastBorderRadius': '8px',
		'--toastBoxShadow': '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
		'--toastBorder': '1px solid #ef4444'
	},
	info: {
		'--toastBackground': '#3b82f6',
		'--toastColor': '#ffffff',
		'--toastBarBackground': '#2563eb',
		'--toastBorderRadius': '8px',
		'--toastBoxShadow': '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
		'--toastBorder': '1px solid #3b82f6'
	},
	warning: {
		'--toastBackground': '#f59e0b',
		'--toastColor': '#ffffff',
		'--toastBarBackground': '#d97706',
		'--toastBorderRadius': '8px',
		'--toastBoxShadow': '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
		'--toastBorder': '1px solid #f59e0b'
	}
};

export function showToast(message: string, themeName: string) {
	const theme = toastThemes[themeName as keyof typeof toastThemes] || {};
	toast.push(message, { theme, duration: 3000 });
}
