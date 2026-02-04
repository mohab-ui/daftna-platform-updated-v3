import React from "react";

type IconProps = React.SVGProps<SVGSVGElement> & {
  title?: string;
};

function BaseIcon({ title, children, ...props }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden={title ? undefined : true}
      role={title ? "img" : "presentation"}
      {...props}
    >
      {title ? <title>{title}</title> : null}
      {children}
    </svg>
  );
}

/** A simple pill/capsule icon for Pharma. */
export function PillIcon(props: IconProps) {
  return (
    <BaseIcon
      {...props}
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9.3 5.6 5.6 9.3a4.1 4.1 0 0 0 5.8 5.8l3.7-3.7a4.1 4.1 0 0 0-5.8-5.8Z" />
      <path d="M8 8l8 8" />
    </BaseIcon>
  );
}

/** A minimal microscope icon for Micro. */
export function MicroscopeIcon(props: IconProps) {
  return (
    <BaseIcon
      {...props}
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9 3h3l1 6-3 .6L9 3Z" />
      <path d="M8.6 9.8 7 10.2a2 2 0 0 0-1.5 2.4l.5 2" />
      <path d="M11.5 10.2 10 10.6" />
      <path d="M7 20h10" />
      <path d="M8 16a5 5 0 0 0 10 0v-1H8v1Z" />
      <path d="M15.5 6.5 18 6" />
    </BaseIcon>
  );
}

/** A simple bacteria/bug icon (good for Parasitology/Micro variants). */
export function BacteriaIcon(props: IconProps) {
  return (
    <BaseIcon
      {...props}
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 7c3 0 5 2.2 5 5s-2 5-5 5-5-2.2-5-5 2-5 5-5Z" />
      <path d="M9.2 9.3 7.8 7.8" />
      <path d="M14.8 9.3l1.4-1.5" />
      <path d="M9.2 14.7l-1.4 1.5" />
      <path d="M14.8 14.7l1.4 1.5" />
      <path d="M10.5 12h.01" />
      <path d="M13.5 12h.01" />
    </BaseIcon>
  );
}

/** A flask icon (Path/biochem/general lab). */
export function FlaskIcon(props: IconProps) {
  return (
    <BaseIcon
      {...props}
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M10 3h4" />
      <path d="M10 3v5l-4.2 7.2A3 3 0 0 0 8.4 20h7.2a3 3 0 0 0 2.6-4.8L14 8V3" />
      <path d="M8.2 14h7.6" />
    </BaseIcon>
  );
}

/** A DNA icon for Bio/Genetics. */
export function DnaIcon(props: IconProps) {
  return (
    <BaseIcon
      {...props}
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M8 3c0 4 8 4 8 8s-8 4-8 10" />
      <path d="M16 3c0 4-8 4-8 8s8 4 8 10" />
      <path d="M9.5 7h5" />
      <path d="M9.5 11h5" />
      <path d="M9.5 15h5" />
    </BaseIcon>
  );
}

/** Fallback course icon. */
export function BookIcon(props: IconProps) {
  return (
    <BaseIcon
      {...props}
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M7 5.5C7 4.7 7.7 4 8.5 4H19v16H8.5A1.5 1.5 0 0 0 7 21.5V5.5Z" />
      <path d="M7 20V5.2" />
      <path d="M10 8h6" />
    </BaseIcon>
  );
}
