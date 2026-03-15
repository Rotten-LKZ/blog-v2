<template>
	<div class="counter">
		<span class="counter-label">{{ label }}</span>
		<div class="counter-controls">
			<button class="btn" @click="count--">-</button>
			<span class="counter-value">{{ count }}</span>
			<button class="btn" @click="count++">+</button>
		</div>
	</div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

const props = defineProps<{
	label?: string;
	initial?: number;
}>();

const count = ref(props.initial ?? 0);
</script>

<style scoped>
.counter {
	display: inline-flex;
	flex-direction: column;
	align-items: center;
	gap: 0.5rem;
	padding: 1rem 1.5rem;
	background: var(--color-bg-card);
	border-radius: 12px;
	box-shadow: var(--shadow-soft);
	border: 2px solid var(--color-border);
}

.counter-label {
	font-size: 0.85em;
	color: var(--color-text-light);
	font-weight: 600;
}

.counter-controls {
	display: flex;
	align-items: center;
	gap: 0.75rem;
}

.counter-value {
	font-size: 1.5em;
	font-weight: 700;
	min-width: 2em;
	text-align: center;
	color: var(--color-primary);
}

.btn {
	width: 36px;
	height: 36px;
	border: none;
	border-radius: 50%;
	background: var(--color-primary);
	color: white;
	font-size: 1.2em;
	font-weight: 700;
	cursor: pointer;
	display: flex;
	align-items: center;
	justify-content: center;
	transition: background 0.2s, transform 0.1s;
}

.btn:hover {
	background: var(--color-primary-light);
}

.btn:active {
	transform: scale(0.92);
}
</style>
