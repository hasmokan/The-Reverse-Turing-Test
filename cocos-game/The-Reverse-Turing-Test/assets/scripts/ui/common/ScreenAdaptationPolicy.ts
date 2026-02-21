import { Canvas, Size, view } from cc;

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
    canvas: Canvas,
    standardRatio: number,
    preferFitWidth: boolean
): ScreenAdaptationResult {
    const screenSize: Size = view.getFrameSize();
    const currentRatio = screenSize.width / screenSize.height;

    if (preferFitWidth) {
        canvas.fitWidth = true;
        canvas.fitHeight = false;
    } else if (currentRatio <= standardRatio) {
        canvas.fitWidth = true;
        canvas.fitHeight = false;
    } else {
        canvas.fitWidth = false;
        canvas.fitHeight = true;
    }

    return {
        fitWidth: canvas.fitWidth,
        fitHeight: canvas.fitHeight,
        currentRatio,
    };
}
