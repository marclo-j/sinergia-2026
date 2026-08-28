"use client"

import * as React from "react"
import { useCallback, useEffect, useLayoutEffect, useRef } from "react"
import { useAnimate, useReducedMotion, type Transition } from "motion/react"

const borderWidthOf = (b: any): number =>
    Math.max(
        0,
        ...[
            b?.borderWidth,
            b?.borderTopWidth,
            b?.borderRightWidth,
            b?.borderBottomWidth,
            b?.borderLeftWidth,
        ].map((v) => parseFloat(String(v ?? "")) || 0)
    )

const borderColorOf = (b: any): string => b?.borderColor ?? "transparent"

const borderBoxOf = (b: any): React.CSSProperties => {
    const { borderColor, ...rest } = (b ?? {}) as any
    return rest as React.CSSProperties
}

const DEFAULT_TRANSITION: Transition = {
    type: "tween",
    duration: 0.35,
    ease: [0.16, 1, 0.3, 1],
}

const ICON_TRANSITION: Transition = { duration: 0.25, ease: "easeInOut" }

type Colors = {
    fill?: string
    textColor?: string
    hoverFill?: string
    hoverTextColor?: string
}

const COLOR_DEFAULTS: Required<Colors> = {
    fill: "#FFFFFF",
    textColor: "#000000",
    hoverFill: "#FC731C",
    hoverTextColor: "#FFFFFF",
}

const ICON_DEFAULTS = {
    background: "#222222",
    color: "#FFFFFF",
    hoverBackground: "#FFFFFF",
    hoverColor: "#000000",
    restSymbol: "↗",
    hoverSymbol: "↗",
    size: 26,
    padding: 14,
    angle: 315,
}

const DEFAULT_HOVER_BORDER_COLOR = "#111111"

const DEFAULT_FONT: React.CSSProperties = {
    fontSize: 40,
    fontWeight: 600,
    letterSpacing: "0.03em",
    lineHeight: "1.2em",
}

const radiusFromPercent = (w: number, h: number, pct: number) =>
    (Math.min(w, h) / 2) * (Math.max(0, Math.min(100, pct)) / 100)

const useIsoLayoutEffect =
    typeof window !== "undefined" ? useLayoutEffect : useEffect

const normalizeAngle = (deg: number | string | undefined): number => {
    const parsed =
        typeof deg === "number" ? deg : parseFloat(String(deg ?? ""))
    if (!Number.isFinite(parsed)) return ICON_DEFAULTS.angle
    return ((parsed % 360) + 360) % 360
}

const srcOf = (img: any): string =>
    typeof img === "string" ? img : img && img.src ? img.src : ""

const ARROW_ANGLES: Record<string, number> = {
    "↗": 315,
    "→": 0,
    "↘": 45,
    "↓": 90,
    "↙": 135,
    "←": 180,
    "↖": 225,
    "↑": 270,
}

const arrowAngleOf = (symbol: string): number | undefined =>
    ARROW_ANGLES[symbol.trim()]

interface IconSettings {
    type?: "symbol" | "image"
    restSymbol?: string
    hoverSymbol?: string
    restImage?: any
    hoverImage?: any
    color?: string
    hoverColor?: string
    size?: number
    padding?: number
    rounded?: number
    background?: string
    hoverBackground?: string
    angle?: number
    side?: "left" | "right"
    position?: "left" | "right"
}

interface AnimatedButtonProps {
    label?: string
    showText?: boolean
    textSide?: "top" | "bottom"
    font?: Record<string, any>
    padding?: string
    rounded?: number
    colors?: Colors
    border?: any
    hoverBorderColor?: string
    addIcon?: boolean
    icon?: IconSettings
    gap?: number
    link?: string
    transition?: Transition
    newTab?: boolean
    style?: React.CSSProperties
}

const EMPTY_ICON: NonNullable<AnimatedButtonProps["icon"]> = {}

export function LabelSlideButton(props: AnimatedButtonProps) {
    const {
        label = "LABEL SLIDE",
        showText = true,
        textSide = "top",
        font,
        padding = "40px 64px 40px 64px",
        rounded = 100,
        colors,
        border = { borderColor: "#000000", borderStyle: "solid", borderWidth: 0 },
        hoverBorderColor,
        addIcon = true,
        icon = { side: "left", size: 26, type: "symbol", angle: 315, color: "#FFFFFF", padding: 14, rounded: 100, restImage: "", background: "#222222", hoverColor: "#000000", hoverImage: "", restSymbol: "↗", hoverSymbol: "↗", hoverBackground: "#FFFFFF" },
        gap = 32,
        link,
        transition = { ease: [0.16, 1, 0.3, 1], mass: 1, type: "tween", damping: 60, duration: 0.35, stiffness: 800 },
        newTab = true,
        style,
    } = props

    const {
        type: iconType = "symbol",
        restSymbol = ICON_DEFAULTS.restSymbol,
        hoverSymbol = ICON_DEFAULTS.hoverSymbol,
        restImage,
        hoverImage,
        color: iconColor = ICON_DEFAULTS.color,
        hoverColor: hoverIconColor = ICON_DEFAULTS.hoverColor,
        size: iconSizeProp = ICON_DEFAULTS.size,
        padding: iconPaddingProp = ICON_DEFAULTS.padding,
        rounded: iconRounded = 100,
        background: iconBg = ICON_DEFAULTS.background,
        hoverBackground: hoverIconBg = ICON_DEFAULTS.hoverBackground,
        angle: moveAngleProp = ICON_DEFAULTS.angle,
        side: iconSideProp,
        position: iconPositionLegacy,
    } = icon

    const iconPosition = iconSideProp ?? iconPositionLegacy ?? "left"

    const [scope, animate] = useAnimate()
    const labelUpRef = useRef<HTMLSpanElement>(null)
    const labelDownRef = useRef<HTMLSpanElement>(null)
    const badgeRef = useRef<HTMLSpanElement>(null)
    const iconOutRef = useRef<HTMLSpanElement>(null)
    const iconInRef = useRef<HTMLSpanElement>(null)
    const hovered = useRef(false)
    const reducedMotion = useReducedMotion()

    useIsoLayoutEffect(() => {
        const root = scope.current as HTMLElement | null
        if (!root) return
        const apply = () => {
            const w = root.offsetWidth
            const h = root.offsetHeight
            if (!w || !h) return
            root.style.borderRadius = `${radiusFromPercent(w, h, rounded)}px`
        }
        apply()
        const ro = new ResizeObserver(apply)
        ro.observe(root)
        return () => ro.disconnect()
    }, [scope, rounded, padding, showText])

    const fontStyles = { ...DEFAULT_FONT, ...(font ?? {}) } as React.CSSProperties

    const glyphSize = Math.max(1, Math.round(iconSizeProp))
    const iconRadius = radiusFromPercent(glyphSize, glyphSize, iconRounded)
    const iconPadding = Math.max(0, Math.round(iconPaddingProp))
    const badgeSize = glyphSize + iconPadding * 2
    const badgeRadius = `${Math.max(0, Math.min(100, Math.round(iconRounded))) / 2}%`

    const moveAngle = normalizeAngle(moveAngleProp)
    const travel = (glyphSize + 2) * 1.5
    const travelX = Math.cos((moveAngle * Math.PI) / 180) * travel
    const travelY = Math.sin((moveAngle * Math.PI) / 180) * travel

    const labelExit = textSide === "bottom" ? "100%" : "-100%"
    const labelEnter = textSide === "bottom" ? "-100%" : "100%"

    const { fill, textColor, hoverFill, hoverTextColor } = {
        ...COLOR_DEFAULTS,
        ...(colors ?? {}),
    }

    const resolvedHoverBorderColor = hoverBorderColor ?? borderColorOf(border)

    const opts = useCallback(
        (): Transition => (reducedMotion ? { duration: 0 } : transition),
        [reducedMotion, transition]
    )

    const apply = useCallback(
        (toHover: boolean, instant: boolean) => {
            const t: Transition = instant ? { duration: 0 } : opts()
            const it: Transition =
                instant || reducedMotion ? { duration: 0 } : ICON_TRANSITION

            const rootColors = {
                backgroundColor: toHover ? hoverFill : fill,
                color: toHover ? hoverTextColor : textColor,
                borderColor: toHover
                    ? resolvedHoverBorderColor
                    : borderColorOf(border),
            }
            const badgeColors = {
                backgroundColor: toHover ? hoverIconBg : iconBg,
                color: toHover ? hoverIconColor : iconColor,
            }

            if (instant) {
                Object.assign(scope.current?.style ?? {}, rootColors)
                Object.assign(badgeRef.current?.style ?? {}, badgeColors)
            }

            if (scope.current && !instant)
                animate(scope.current, rootColors as any, t as any)
            if (labelUpRef.current)
                animate(
                    labelUpRef.current,
                    { y: toHover ? labelExit : "0%" } as any,
                    t as any
                )
            if (labelDownRef.current)
                animate(
                    labelDownRef.current,
                    { y: toHover ? "0%" : labelEnter } as any,
                    t as any
                )
            if (badgeRef.current && !instant)
                animate(badgeRef.current, badgeColors as any, t as any)
            if (iconOutRef.current)
                animate(
                    iconOutRef.current,
                    {
                        x: toHover ? travelX : 0,
                        y: toHover ? travelY : 0,
                        opacity: toHover ? 0 : 1,
                    } as any,
                    it as any
                )
            if (iconInRef.current)
                animate(
                    iconInRef.current,
                    {
                        x: toHover ? 0 : -travelX,
                        y: toHover ? 0 : -travelY,
                        opacity: toHover ? 1 : 0,
                    } as any,
                    it as any
                )
        },
        [
            animate,
            scope,
            opts,
            reducedMotion,
            fill,
            hoverFill,
            textColor,
            hoverTextColor,
            border,
            resolvedHoverBorderColor,
            iconBg,
            hoverIconBg,
            iconColor,
            hoverIconColor,
            travelX,
            travelY,
            labelExit,
            labelEnter,
        ]
    )

    useIsoLayoutEffect(() => {
        if (hovered.current) return
        apply(false, true)
    }, [apply, showText, addIcon])

    const onEnter = () => {
        hovered.current = true
        apply(true, false)
    }

    const onLeave = () => {
        hovered.current = false
        apply(false, false)
        if (scope.current)
            animate(scope.current, { scale: 1 } as any, opts() as any)
    }

    const onFocus = (e: React.FocusEvent<HTMLElement>) => {
        if (e.currentTarget.matches(":focus-visible")) onEnter()
    }

    const onBlur = () => {
        if (hovered.current) onLeave()
    }

    const isLink = typeof link === "string" && link.length > 0
    const Tag: any = isLink ? "a" : "button"
    const tagProps = {
        "aria-label": showText ? undefined : label || undefined,
        ...(isLink
            ? {
                  href: link,
                  target: newTab ? "_blank" : undefined,
                  rel: newTab ? "noopener noreferrer" : undefined,
              }
            : { type: "button" }),
    }

    const renderIcon = (symbol: string, image: any) => {
        const src = srcOf(image)
        if (iconType === "image" && src)
            return (
                <img
                    src={src}
                    alt=""
                    aria-hidden
                    draggable={false}
                    style={{
                        width: glyphSize,
                        height: glyphSize,
                        objectFit: iconRadius > 0 ? "cover" : "contain",
                        borderRadius: Math.min(iconRadius, glyphSize / 2),
                        display: "block",
                        pointerEvents: "none",
                    }}
                />
            )

        const arrowAngle = iconType === "symbol" ? arrowAngleOf(symbol) : undefined
        if (arrowAngle !== undefined) {
            const rotation = arrowAngle - 315
            return (
                <svg
                    width={glyphSize}
                    height={glyphSize}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{
                        display: "block",
                        transform: `rotate(${rotation}deg)`,
                        pointerEvents: "none",
                    }}
                >
                    <path d="M7 17L17 7" />
                    <path d="M7 7h10v10" />
                </svg>
            )
        }

        return (
            <span
                style={{
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: glyphSize,
                    lineHeight: 1,
                    color: "currentColor",
                    fontFamily: "inherit",
                    whiteSpace: "nowrap",
                }}
            >
                {symbol}
            </span>
        )
    }

    return (
        <Tag
            {...tagProps}
            ref={scope}
            onPointerEnter={onEnter}
            onPointerLeave={onLeave}
            onPointerCancel={onLeave}
            onFocus={onFocus}
            onBlur={onBlur}
            onPointerDown={() =>
                scope.current &&
                animate(scope.current, { scale: 0.97 } as any, opts() as any)
            }
            onPointerUp={() =>
                scope.current &&
                animate(scope.current, { scale: 1 } as any, opts() as any)
            }
            style={{
                display: "inline-flex",
                flexDirection: iconPosition === "left" ? "row-reverse" : "row",
                alignItems: "center",
                justifyContent: "center",
                gap: showText && addIcon ? `${gap}px` : 0,
                padding,
                ...borderBoxOf(border),
                textDecoration: "none",
                cursor: "pointer",
                overflow: "hidden",
                position: "relative",
                userSelect: "none",
                boxSizing: "border-box",
                willChange: "transform",
                ...fontStyles,
                minWidth: "min-content",
                minHeight: "min-content",
                ...style,
            }}
        >
            {showText && (
                <span
                    style={{
                        position: "relative",
                        display: "inline-block",
                        overflow: "hidden",
                        whiteSpace: "nowrap",
                    }}
                >
                    <span style={{ visibility: "hidden" }}>{label}</span>
                    <span
                        ref={labelUpRef}
                        style={{
                            position: "absolute",
                            inset: 0,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                        }}
                    >
                        {label}
                    </span>
                    <span
                        ref={labelDownRef}
                        style={{
                            position: "absolute",
                            inset: 0,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            transform: `translateY(${labelEnter})`,
                        }}
                    >
                        {label}
                    </span>
                </span>
            )}

            {addIcon && (
                <span
                    ref={badgeRef}
                    style={{
                        position: "relative",
                        flexShrink: 0,
                        width: badgeSize,
                        height: badgeSize,
                        borderRadius: badgeRadius,
                        overflow: "hidden",
                    }}
                >
                    <span
                        ref={iconOutRef}
                        style={{
                            position: "absolute",
                            inset: 0,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                        }}
                    >
                        {renderIcon(restSymbol, restImage)}
                    </span>
                    <span
                        ref={iconInRef}
                        style={{
                            position: "absolute",
                            inset: 0,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            opacity: 0,
                        }}
                    >
                        {renderIcon(hoverSymbol, hoverImage)}
                    </span>
                </span>
            )}
        </Tag>
    )
}

const __originkitPresetProps = {
    "icon": {
        "side": "left",
        "size": 26,
        "type": "symbol",
        "angle": 315,
        "color": "#FFFFFF",
        "padding": 14,
        "rounded": 100,
        "restImage": "",
        "background": "#222222",
        "hoverColor": "#000000",
        "hoverImage": "",
        "restSymbol": "↗",
        "hoverSymbol": "↗",
        "hoverBackground": "#FFFFFF"
    }
};

export default function LabelSlideButtonPreset(props: Record<string, unknown>) {
    return <LabelSlideButton {...(__originkitPresetProps as Record<string, unknown>)} {...props} />;
}
