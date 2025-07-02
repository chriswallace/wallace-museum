import { fail } from '@sveltejs/kit';
import type { Action, Actions, PageServerLoad } from './$types';
import { db } from '$lib/prisma';

export const load: PageServerLoad = async () => {
	// todo
};

const reset: Action = async ({ request }) => {
	const data = await request.formData();
	const email = data.get('username'); // Using username field but expecting email

	if (typeof email !== 'string' || !email) {
		return fail(400, { invalid: true });
	}

	// Basic email validation
	const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
	if (!emailRegex.test(email)) {
		return fail(400, { invalid: true });
	}

	try {
		// Check if user exists with this email
		const user = await db.read.user.findUnique({ where: { email } });

		// For security, always return success even if user doesn't exist
		// This prevents email enumeration attacks

		if (user) {
			// TODO: Generate reset token and send email
			// For now, just log that a reset was requested
			console.log(`Password reset requested for: ${email}`);

			// In a real implementation, you would:
			// 1. Generate a secure reset token
			// 2. Store it in the database with expiration
			// 3. Send reset email with token link
		}

		// Always return success to prevent user enumeration
		return {
			success: true,
			message: 'If an account with that email exists, a password reset link has been sent.'
		};
	} catch (error) {
		console.error('Password reset error:', error);
		return fail(500, { error: 'Password reset failed' });
	}
};

export const actions: Actions = { reset };
