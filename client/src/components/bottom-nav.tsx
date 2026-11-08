import { useLocation } from "wouter";
import homeIcon from "@assets/index_active_1793888712134.png";
import investIcon from "@assets/stable_1793888712216.png";
import noticeIcon from "@assets/notice_(1)_1793888712246.png";
import blogIcon from "@assets/blog_(2)_1793888712283.png";
import accountIcon from "@assets/my_1793888712313.png";

const navItems = [
  { path: "/", label: "Maison", icon: homeIcon, testId: "nav-accueil" },
  { path: "/invest", label: "Investir", icon: investIcon, testId: "nav-investir" },
  { path: "/notice", label: "Notice", icon: noticeIcon, testId: "nav-notice", featured: true },
  { path: "/blog", label: "Blog", icon: blogIcon, testId: "nav-blog" },
  { path: "/account", label: "Compte", icon: accountIcon, testId: "nav-compte" },
];

const PEPSICO_RED = "#ed1f5b";

export default function BottomNav() {
  const [location, navigate] = useLocation();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-[#eeeeee] bg-white text-[#999999]"
      aria-label="Navigation principale"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <div className="mx-auto grid h-[88px] max-w-[512px] grid-cols-5 items-stretch">
        {navItems.map(({ path, label, icon, testId, featured }) => {
          const isActive = location === path || (path !== "/" && location.startsWith(`${path}/`));
          const iconFilter = featured
            ? "brightness(0) invert(1)"
            : isActive
              ? "brightness(0) saturate(100%) invert(25%) sepia(90%) saturate(3850%) hue-rotate(326deg) brightness(96%) contrast(96%)"
              : "grayscale(1) brightness(.62)";

          return (
            <button
              key={path}
              type="button"
              onClick={() => {
                navigate(path);
                if (path === "/") window.dispatchEvent(new Event("home-tab-clicked"));
              }}
              className="relative flex h-full min-w-0 flex-col items-center justify-end gap-[7px] rounded-none bg-transparent pb-[10px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-[#ed1f5b] active:opacity-75"
              data-testid={testId}
              aria-current={isActive ? "page" : undefined}
            >
              {featured ? (
                <span
                  className="absolute left-1/2 top-[-30px] flex h-[64px] w-[64px] -translate-x-1/2 items-center justify-center rounded-full border-[5px] border-white shadow-sm"
                  style={{ backgroundColor: PEPSICO_RED }}
                >
                  <img
                    src={icon}
                    className="h-[28px] w-[28px] object-contain"
                    style={{ filter: iconFilter }}
                    alt=""
                    aria-hidden="true"
                  />
                </span>
              ) : (
                <img
                  src={icon}
                  className="h-[36px] w-[38px] object-contain"
                  style={{ filter: iconFilter }}
                  alt=""
                  aria-hidden="true"
                />
              )}
              <span
                className="text-[14px] font-normal leading-none"
                style={{ color: isActive ? PEPSICO_RED : "#999999" }}
              >
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
