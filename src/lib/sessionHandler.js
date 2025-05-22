import { v4 as uuidv4 } from 'uuid';

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

	const session = await prisma.session.findUnique({
		where: { sessionId },
		include: { user: true }
	});

	if (!session) {
		return false; // Session not found
	}

	// Optionally check for session expiration
	if (new Date() > new Date(session.expiresAt)) {
		return false; // Session expired
	}

	return session.user && session.user.isAdmin; // Check if user is admin
}
