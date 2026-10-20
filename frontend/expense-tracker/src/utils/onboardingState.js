/**
 * Keeps the onboarding tour's position across page changes.
 *
 * The tour moves between pages to point at elements that only exist on one
 * of them, and moving unmounts the component. The step is therefore kept
 * here rather than in component state, so the tour resumes where it was.
 */
let step = 0;

export const getTourStep = () => step;

export const setTourStep = (value) => {
    step = value;
};

export const resetTourStep = () => {
    step = 0;
};
