import bcrypt from 'bcryptjs';
import prisma from '$lib/prisma'; // Ensure this path is correct for your Prisma client
import type { RequestHandler } from '@sveltejs/kit';

export const POST: RequestHandler = async ({ request }) => {
    try {
        // Parse the request body
        const data = await request.json();
        const { email, username, password } = data;

        // Hash the password
        const passwordHash = await bcrypt.hash(password, 10);

        // Create the admin user in the database
        const user = await prisma.adminUser.create({
            data: { email, username, passwordHash },
        });

        console.log(user);

        return new Response(JSON.stringify({ message: 'Admin user created' }), {
            status: 200,
            headers: {
                'Content-Type': 'application/json'
            }
        });
    } catch (error) {
        console.error('Error while creating admin user:', error);

        return new Response(JSON.stringify({ message: 'Error creating admin user', error: error.message }), {
            status: 500,
            headers: {
                'Content-Type': 'application/json'
            }
        });
    }
};
