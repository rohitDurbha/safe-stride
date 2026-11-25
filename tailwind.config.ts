import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

export default {
	darkMode: ["class"],
	content: [
		"./pages/**/*.{ts,tsx}",
		"./components/**/*.{ts,tsx}",
		"./app/**/*.{ts,tsx}",
		"./src/**/*.{ts,tsx}",
	],
	prefix: "",
	theme: {
		container: {
			center: true,
			padding: '2rem',
			screens: {
				'2xl': '1400px'
			}
		},
		extend: {
			fontFamily: {
				sans: ['Geist', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
			},
			colors: {
				border: 'hsl(var(--border))',
				input: 'hsl(var(--input))',
				ring: 'hsl(var(--ring))',
				background: 'hsl(var(--background))',
				foreground: 'hsl(var(--foreground))',
				primary: {
					DEFAULT: 'hsl(var(--primary))',
					foreground: 'hsl(var(--primary-foreground))'
				},
				secondary: {
					DEFAULT: 'hsl(var(--secondary))',
					foreground: 'hsl(var(--secondary-foreground))'
				},
				destructive: {
					DEFAULT: 'hsl(var(--destructive))',
					foreground: 'hsl(var(--destructive-foreground))'
				},
				muted: {
					DEFAULT: 'hsl(var(--muted))',
					foreground: 'hsl(var(--muted-foreground))'
				},
				accent: {
					DEFAULT: 'hsl(var(--accent))',
					foreground: 'hsl(var(--accent-foreground))'
				},
				popover: {
					DEFAULT: 'hsl(var(--popover))',
					foreground: 'hsl(var(--popover-foreground))'
				},
				card: {
					DEFAULT: 'hsl(var(--card))',
					foreground: 'hsl(var(--card-foreground))'
				}
			},
			borderRadius: {
				xl: 'calc(var(--radius) + 4px)',
				lg: 'var(--radius)',
				md: 'calc(var(--radius) - 2px)',
				sm: 'calc(var(--radius) - 4px)'
			},
			keyframes: {
				'accordion-down': {
					from: {
						height: '0'
					},
					to: {
						height: 'var(--radix-accordion-content-height)'
					}
				},
				'accordion-up': {
					from: {
						height: 'var(--radix-accordion-content-height)'
					},
					to: {
						height: '0'
					}
				},
				'blur-in': {
					from: { opacity: '0', filter: 'blur(8px)', transform: 'translateY(6px)' },
					to: { opacity: '1', filter: 'blur(0)', transform: 'translateY(0)' }
				},
				'sheet-up': {
					from: { transform: 'translateY(100%)' },
					to: { transform: 'translateY(0)' }
				},
				shimmer: {
					from: { backgroundPosition: '150% 0' },
					to: { backgroundPosition: '-100% 0' }
				},
				breathe: {
					'0%': { transform: 'scale(1)', opacity: '0.9' },
					'100%': { transform: 'scale(3.2)', opacity: '0' }
				},
				ripple: {
					'0%': { transform: 'scale(1)', opacity: '0.35' },
					'100%': { transform: 'scale(1.9)', opacity: '0' }
				}
			},
			animation: {
				'accordion-down': 'accordion-down 0.2s ease-out',
				'accordion-up': 'accordion-up 0.2s ease-out',
				'blur-in': 'blur-in 0.45s cubic-bezier(0.22, 1, 0.36, 1) backwards',
				'sheet-up': 'sheet-up 0.5s cubic-bezier(0.32, 0.72, 0, 1) backwards',
				shimmer: 'shimmer 1.6s linear infinite',
				breathe: 'breathe 2.4s ease-out infinite',
				ripple: 'ripple 1.8s ease-out infinite'
			},
			transitionTimingFunction: {
				spring: 'cubic-bezier(0.32, 0.72, 0, 1)'
			}
		}
	},
	plugins: [tailwindcssAnimate],
} satisfies Config;
