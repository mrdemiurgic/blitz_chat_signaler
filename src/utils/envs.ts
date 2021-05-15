const envs = ["XIRSYS_SECRET", "XIRSYS_URL", "USERS_PER_ROOM_LIMIT"];

const checkEnvs = () => {
  envs.forEach((env) => {
    if (process.env[env] === undefined) {
      throw new Error(`ENV: ${env} env var is unset`);
    }
  });
};

export default checkEnvs;
