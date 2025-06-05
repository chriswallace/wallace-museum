// src/routes/api/password-reset.js
import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { db } from '$lib/prisma';
import bcrypt from 'bcryptjs';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { userId, newPassword } = await request.json();
		
		if (!userId || !newPassword) {
			return json({ error: 'User ID and new password are required' }, { status: 400 });
		}
		
		// Hash the new password
		const hashedPassword = await bcrypt.hash(newPassword, 12);
		
		// Update user password
		await db.write.user.update({
			where: { id: userId },
			data: { 
				passwordHash: hashedPassword
			}
		});
		
		return json({ success: true, message: 'Password reset successfully' });
	} catch (error) {
		console.error('Error resetting password:', error);
		return json({ error: 'Failed to reset password' }, { status: 500 });
	}
};
