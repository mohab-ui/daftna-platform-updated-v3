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

export function FolderIcon(props: IconProps) {
  return (
    <BaseIcon
      {...props}
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3.5 7.5h6l2 2H20.5a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-17a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2Z" />
    </BaseIcon>
  );
}

export function ChevronRightIcon(props: IconProps) {
  return (
    <BaseIcon
      {...props}
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9 6l6 6-6 6" />
    </BaseIcon>
  );
}

export function PdfIcon(props: IconProps) {
  return (
    <BaseIcon
      {...props}
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M8 3.5h6l2.5 2.5V20a1.5 1.5 0 0 1-1.5 1.5H8A1.5 1.5 0 0 1 6.5 20V5A1.5 1.5 0 0 1 8 3.5Z" />
      <path d="M14 3.5V6a1 1 0 0 0 1 1h2.5" />
      <path d="M8.5 14.5h7" />
      <path d="M8.5 17.5h5" />
    </BaseIcon>
  );
}

export function AudioIcon(props: IconProps) {
  return (
    <BaseIcon
      {...props}
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M11 8 8.5 10H6v4h2.5L11 16V8Z" />
      <path d="M14.5 9.5a3.5 3.5 0 0 1 0 5" />
      <path d="M16.5 7.5a6 6 0 0 1 0 9" />
    </BaseIcon>
  );
}

export function LinkIcon(props: IconProps) {
  return (
    <BaseIcon
      {...props}
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M10.5 13.5 9 15a3 3 0 0 1-4.2 0 3 3 0 0 1 0-4.2l1.8-1.8" />
      <path d="M13.5 10.5 15 9a3 3 0 0 1 4.2 0 3 3 0 0 1 0 4.2l-1.8 1.8" />
      <path d="M9.5 14.5 14.5 9.5" />
    </BaseIcon>
  );
}

export function AttachmentIcon(props: IconProps) {
  return (
    <BaseIcon
      {...props}
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M8 12.5 12.5 8a3 3 0 1 1 4.2 4.2l-5.6 5.6a4.5 4.5 0 0 1-6.4-6.4l5.2-5.2" />
    </BaseIcon>
  );
}
