import { Canvas, ResolutionPolicy, Size, view, screen, log as ccLog } from 'cc';

export interface ScreenAdaptationResult {
    fitWidth: boolean;
    fitHeight: boolean;
    currentRatio: number;
}

/**
 * 统一 Canvas 缩放策略：默认宽度优先，满足“宽度不裁切”。
 * 当 preferFitWidth=false 时，回退到按宽高比分支（文章方案）。
 */
export function applyCanvasScaleMode(
    _canvas: Canvas,
    standardRatio: number,
    preferFitWidth: boolean
): ScreenAdaptationResult {
    const screenSize: Size = screen.windowSize;
    const currentRatio = screenSize.width / screenSize.height;
    const beforeDesignSize = view.getDesignResolutionSize();
    let fitWidth = false;
    let fitHeight = false;

    if (preferFitWidth) {
        fitWidth = true;
        fitHeight = false;
    } else if (currentRatio <= standardRatio) {
        fitWidth = true;
        fitHeight = false;
    } else {
        fitWidth = false;
        fitHeight = true;
    }

    const policy = fitWidth ? ResolutionPolicy.FIXED_WIDTH : ResolutionPolicy.FIXED_HEIGHT;
    view.setDesignResolutionSize(beforeDesignSize.width, beforeDesignSize.height, policy);
    const afterDesignSize = view.getDesignResolutionSize();
    const visibleSize = view.getVisibleSize();

    ccLog(
        `[ScreenAdaptationPolicy] apply policy=${fitWidth ? 'FIXED_WIDTH' : 'FIXED_HEIGHT'} ` +
        `preferFitWidth=${preferFitWidth} standardRatio=${standardRatio.toFixed(4)} currentRatio=${currentRatio.toFixed(4)} ` +
        `frame=${screenSize.width}x${screenSize.height} visible=${visibleSize.width}x${visibleSize.height} ` +
        `design(before)=${beforeDesignSize.width}x${beforeDesignSize.height} design(after)=${afterDesignSize.width}x${afterDesignSize.height}`
    );

    return {
        fitWidth,
        fitHeight,
        currentRatio,
    };
}
