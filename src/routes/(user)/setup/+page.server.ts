import { fail, redirect } from '@sveltejs/kit'
import type { Action, Actions, PageServerLoad } from './$types'
import bcrypt from 'bcryptjs'
import prisma from '$lib/prisma'

export const load: PageServerLoad = async () => {

}

const register: Action = async ({ request }) => {

    const data = await request.formData()
    const username = data.get('username')
    const email = data.get('email')
    const password = data.get('password')

    if (
        typeof username !== 'string' ||
        typeof email !== 'string' ||
        typeof password !== 'string' ||
        !username ||
        !email ||
        !password
    ) {
        return fail(400, { invalid: true })
    }

    const anyUser = await prisma.user.findFirst()

    if (anyUser) {
        throw redirect(303, '/login')
    }

    const user = await prisma.user.findUnique({
        where: { username },
    })

    if (user) {
        throw fail(400, { user: true })
    }

    await prisma.user.create({
        data: {
            username,
            email,
            passwordHash: await bcrypt.hash(password, 10),
            userAuthToken: crypto.randomUUID(),
        },
    })

    throw redirect(303, '/login')
}

export const actions: Actions = { register }