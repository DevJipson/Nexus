import {
  CalendarDays,
  ChartNoAxesColumn,
  FolderKanban,
  LayoutDashboard,
  MessagesSquare,
  Settings,
  SquareCheck,
  Users,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  label: string;
  shortLabel: string;
  href: string;
  icon: LucideIcon;
  description: string;
}

export interface NavGroup {
  id: string;
  label: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    id: "workspace",
    label: "Workspace",
    items: [
      {
        label: "Dashboard",
        shortLabel: "Home",
        href: "/dashboard",
        icon: LayoutDashboard,
        description: "Workspace overview and priorities",
      },
      {
        label: "Projects",
        shortLabel: "Projects",
        href: "/projects",
        icon: FolderKanban,
        description: "All projects, milestones and progress",
      },
      {
        label: "My Tasks",
        shortLabel: "Tasks",
        href: "/tasks",
        icon: SquareCheck,
        description: "Your assigned work across projects",
      },
      {
        label: "Calendar",
        shortLabel: "Calendar",
        href: "/calendar",
        icon: CalendarDays,
        description: "Meetings, deadlines and focus time",
      },
    ],
  },
  {
    id: "collaboration",
    label: "Collaboration",
    items: [
      {
        label: "Team",
        shortLabel: "Team",
        href: "/team",
        icon: Users,
        description: "Directory, roles and workload",
      },
      {
        label: "Messages",
        shortLabel: "Messages",
        href: "/messages",
        icon: MessagesSquare,
        description: "Conversations with your team",
      },
    ],
  },
  {
    id: "insights",
    label: "Insights",
    items: [
      {
        label: "Reports",
        shortLabel: "Reports",
        href: "/reports",
        icon: ChartNoAxesColumn,
        description: "Productivity and delivery analytics",
      },
    ],
  },
];

export const SETTINGS_NAV_ITEM: NavItem = {
  label: "Settings",
  shortLabel: "Settings",
  href: "/settings",
  icon: Settings,
  description: "Profile, workspace and appearance",
};

export const ALL_NAV_ITEMS: NavItem[] = [
  ...NAV_GROUPS.flatMap((group) => group.items),
  SETTINGS_NAV_ITEM,
];

export const MOBILE_NAV_ITEMS = [
  ALL_NAV_ITEMS[0],
  ALL_NAV_ITEMS[1],
  ALL_NAV_ITEMS[2],
  ALL_NAV_ITEMS[3],
];

export function getNavItemByHref(href: string): NavItem | undefined {
  return ALL_NAV_ITEMS.find((item) => item.href === href);
}
