// src/routes/api/password-reset-request.js
import prisma from '$lib/prisma';

export async function post(request) {
	const { email } = JSON.parse(request.body);

	const user = await prisma.user.findUnique({ where: { email } });
	if (!user) {
		// Optionally, don't reveal if the email is registered for security
		return {
			status: 200,
			body: { message: 'If your email is registered, you will receive a password reset link.' }
		};
	}

	const token = crypto.randomUUID(); // Generate a unique token
	// Store the token in the database with an expiration time
	// ...

	//await sendPasswordResetEmail(email, token); // Send the email

	return { status: 200, body: { message: 'Password reset email sent.' } };
}
