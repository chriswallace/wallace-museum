import { isModalOpen } from '$lib/stores';

export function openModal() {
	isModalOpen.set(true);
}

export function closeModal() {
	isModalOpen.set(false);
}