export function PetMonster() {
  return (
    <svg viewBox="0 0 300 300" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="petBody" x1="150" y1="84" x2="150" y2="288" gradientUnits="userSpaceOnUse">
          <stop stopColor="#a8ebc2" />
          <stop offset="1" stopColor="#5fc78f" />
        </linearGradient>
        <linearGradient id="petHorn" x1="150" y1="30" x2="150" y2="120" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ffd978" />
          <stop offset="1" stopColor="#f5b73f" />
        </linearGradient>
      </defs>

      <path
        d="M92 118 C78 84 82 56 100 42 C118 28 138 50 144 88 Z"
        fill="url(#petHorn)"
        stroke="#2f6151"
        strokeWidth="11"
        strokeLinejoin="round"
      />
      <path
        d="M208 118 C222 84 218 56 200 42 C182 28 162 50 156 88 Z"
        fill="url(#petHorn)"
        stroke="#2f6151"
        strokeWidth="11"
        strokeLinejoin="round"
      />

      <ellipse cx="66" cy="218" rx="23" ry="13" fill="#ff9fb2" opacity="0.55" />
      <ellipse cx="234" cy="218" rx="23" ry="13" fill="#ff9fb2" opacity="0.55" />

      <path
        d="M150 84 C244 84 286 146 281 218 C276 280 228 288 150 288 C72 288 24 280 19 218 C14 146 56 84 150 84 Z"
        fill="url(#petBody)"
        stroke="#2f6151"
        strokeWidth="12"
      />

      <ellipse cx="150" cy="256" rx="44" ry="22" fill="#d9f8e7" opacity="0.6" />

      <g className="pet-eye-group">
        <ellipse cx="108" cy="180" rx="33" ry="39" fill="#ffffff" stroke="#2f6151" strokeWidth="9" />
        <ellipse cx="196" cy="180" rx="33" ry="39" fill="#ffffff" stroke="#2f6151" strokeWidth="9" />
        <circle cx="97" cy="188" r="14" fill="#243b3a" />
        <circle cx="185" cy="188" r="14" fill="#243b3a" />
        <circle cx="102" cy="181" r="4.5" fill="#ffffff" />
        <circle cx="190" cy="181" r="4.5" fill="#ffffff" />
      </g>

      <path
        d="M136 230 Q150 240 164 230"
        stroke="#2f6151"
        strokeWidth="8"
        strokeLinecap="round"
      />

      <path
        d="M118 148 Q150 138 182 148"
        stroke="#2f6151"
        strokeWidth="5"
        strokeLinecap="round"
        opacity="0.35"
      />
    </svg>
  );
}
