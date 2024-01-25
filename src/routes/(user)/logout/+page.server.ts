import { redirect } from '@sveltejs/kit'
import type { Actions, PageServerLoad } from './$types'

export const load: PageServerLoad = async () => {
    // we only use this endpoint for the api
    // and don't need to see the page
    throw redirect(302, '/login')
}

export const actions: Actions = {
    default({ cookies }) {
        console.log('logout')
        // eat the cookie
        cookies.set('session', '', {
            path: '/',
            expires: new Date(0),
        })

        // redirect the user
        throw redirect(302, '/login')
    },
}
