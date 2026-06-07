import { envConfig } from "../config/env.config.js";
import app from "./app.js";

const { port, host, appUrl } = envConfig;

app.listen(port, host, () => {
    console.log(`Application is running at ${appUrl}`);
});
