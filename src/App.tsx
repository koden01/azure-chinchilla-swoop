// Change this:
const InputPage = React.lazy(() => import("./pages/Input"));
// To:
const InputPage = React.lazy(() => import("./pages/Input").then(module => ({ default: module.default })));