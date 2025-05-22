// src/routes/api/password-reset.js
import prisma from '$lib/prisma';
import bcrypt from 'bcryptjs';
import type { RequestHandler } from '@sveltejs/kit';

export const POST: RequestHandler = async ({ request }) => {
	const { token, newPassword } = JSON.parse(request.body);

	// Verify token and get user
	// ...

	const hashedPassword = await bcrypt.hash(newPassword, 10);
	await prisma.user.update({
		where: { id: user.id },
		data: { passwordHash: hashedPassword }
	});

	return new Response(JSON.stringify({ message: 'Password successfully reset.' }), {
		status: 200,
		headers: {
			'Content-Type': 'application/json'
		}
	});
};
