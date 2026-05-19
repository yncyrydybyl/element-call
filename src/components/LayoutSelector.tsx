/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import {
  type ComponentType,
  type SVGAttributes,
  type FC,
  useState,
} from "react";
import { Button, Menu, MenuItem } from "@vector-im/compound-web";
import { t } from "i18next";
import {
  CheckIcon,
  GridIcon,
  SpotlightIcon,
} from "@vector-im/compound-design-tokens/assets/web/icons";

import { type GridMode } from "../state/CallViewModel/CallViewModel";
import styles from "./LayoutSelector.module.css";

type IconType = ComponentType<SVGAttributes<SVGElement>>;

const TogetherIcon: IconType = (props) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <circle cx="6" cy="10" r="2.5" fill="currentColor" />
    <circle cx="12" cy="9" r="3" fill="currentColor" />
    <circle cx="18" cy="10" r="2.5" fill="currentColor" />
    <path d="M2 19c0-2.5 1.8-4 4-4s4 1.5 4 4v1H2v-1z" fill="currentColor" />
    <path d="M8 19c0-3 1.8-5 4-5s4 2 4 5v1H8v-1z" fill="currentColor" />
    <path d="M14 19c0-2.5 1.8-4 4-4s4 1.5 4 4v1h-8v-1z" fill="currentColor" />
  </svg>
);

const FreeStageIcon: IconType = (props) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <rect
      x="3"
      y="4"
      width="7"
      height="7"
      rx="1.5"
      fill="currentColor"
      transform="rotate(-8 6.5 7.5)"
    />
    <rect
      x="13"
      y="3"
      width="8"
      height="8"
      rx="1.5"
      fill="currentColor"
      transform="rotate(6 17 7)"
    />
    <rect
      x="4"
      y="13"
      width="8"
      height="8"
      rx="1.5"
      fill="currentColor"
      transform="rotate(4 8 17)"
    />
    <rect
      x="14"
      y="14"
      width="7"
      height="7"
      rx="1.5"
      fill="currentColor"
      transform="rotate(-6 17.5 17.5)"
    />
  </svg>
);

const HexagonIcon: IconType = (props) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <path d="M7.5 3.5h4l2 3.46-2 3.46h-4l-2-3.46 2-3.46z" fill="currentColor" />
    <path
      d="M14.5 3.5h4l2 3.46-2 3.46h-4l-2-3.46 2-3.46z"
      fill="currentColor"
    />
    <path d="M11 10.5h4l2 3.46-2 3.46h-4l-2-3.46 2-3.46z" fill="currentColor" />
    <path d="M4 10.5h4l2 3.46-2 3.46H4l-2-3.46L4 10.5z" fill="currentColor" />
    <path d="M18 10.5h4l2 3.46-2 3.46h-4l-2-3.46 2-3.46z" fill="currentColor" />
  </svg>
);

interface LayoutMeta {
  id: GridMode;
  label: string;
  Icon: IconType;
}

function getLayouts(): LayoutMeta[] {
  return [
    {
      id: "spotlight",
      label: t("layout_spotlight_label"),
      Icon: SpotlightIcon,
    },
    { id: "grid", label: t("layout_grid_label"), Icon: GridIcon },
    { id: "together", label: t("layout_together_label"), Icon: TogetherIcon },
    {
      id: "free-stage",
      label: t("layout_free_stage_label"),
      Icon: FreeStageIcon,
    },
    { id: "hexagon", label: t("layout_hexagon_label"), Icon: HexagonIcon },
  ];
}

export interface LayoutSelectorProps {
  value: GridMode;
  onChange: (value: GridMode) => void;
  className?: string;
}

export const LayoutSelector: FC<LayoutSelectorProps> = ({
  value,
  onChange,
  className,
}) => {
  const [open, setOpen] = useState(false);
  const layouts = getLayouts();
  const current = layouts.find((l) => l.id === value) ?? layouts[0];
  const CurrentIcon = current.Icon;

  return (
    <Menu
      title={t("layout_switch_label")}
      showTitle={true}
      open={open}
      onOpenChange={setOpen}
      side="top"
      align="end"
      trigger={
        <Button
          kind="secondary"
          size="md"
          className={className}
          aria-label={t("layout_switch_label")}
          Icon={CurrentIcon}
          data-testid="layout_selector_trigger"
        >
          {current.label}
        </Button>
      }
    >
      {layouts.map(({ id, label, Icon }) => (
        <MenuItem
          key={id}
          hideChevron
          label={label}
          Icon={Icon}
          onSelect={(e) => {
            e.preventDefault();
            onChange(id);
            setOpen(false);
          }}
        >
          {value === id && (
            <CheckIcon width={20} height={20} className={styles.check} />
          )}
        </MenuItem>
      ))}
    </Menu>
  );
};
