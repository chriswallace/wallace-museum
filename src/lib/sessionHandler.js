import { v4 as uuidv4 } from 'uuid';
import { prismaRead } from '$lib/prisma';

const createNewSessionId = () => {
	return uuidv4(); // This generates a unique UUID
};

export async function getSession(request) {
	return request.locals.session;
}

export const handleSession = async (request) => {
	const cookies = request.headers.cookie || '';
	const sessionCookie = cookies.split(';').find((c) => c.trim().startsWith('session='));

	let sessionId = sessionCookie ? sessionCookie.split('=')[1] : '';

	if (!sessionId) {
		// No existing session
		return null;
	}

	return { id: sessionId };
};

export async function verifyAdminSession(sessionId) {
	if (!sessionId) {
		return false; // No session ID provided
	}

	const session = await prismaRead.session.findUnique({
		where: { sessionId },
		include: { User: true }
	});

	if (!session) {
		return false; // Session not found
	}

	// Optionally check for session expiration
	if (new Date() > new Date(session.expiresAt)) {
		return false; // Session expired
	}

	let user = session.User;

	return user !== null; // Check if user exists (simplified admin check)
}
