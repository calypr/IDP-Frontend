# Setup docs

1. We need a cert. I am using the same cert that I use for local development. This cert is tied to the url caliper-training.ohsu.edu.

If you want to use a self signed localhost cert you probably can but you will need to change the .env.development file in packages/samplecommons to be localhost:3000.

use the below link to get the certs.
`https://ohsuitg-my.sharepoint.com/:f:/g/personal/peterkor_ohsu_edu/Et7mGpp5wMNPvOaeMPIlYL4BNjIyWo682ESyJVPXZIr_fw?email=ellrott%40ohsu.edu&e=yYnIaZ`

edit /etc/hosts file to include the URL that the cert is tied to:
`127.0.0.1 caliper-training.ohsu.edu`

2. place these two certs in the `packages/sampleCommons` directory.
   check `packages/sampleCommons/package.json`. Under `scripts` this line

   `"dev": "next dev --experimental-https --experimental-https-key ./privkey.pem --experimental-https-cert ./fullchain.pem"`

   should be pointing to the certs in the same dir.

3. go back to root of this repo and do a `npm i` and a `npm run dev`
   you might also need to do a `npm run build` if you get errs.

4. login to `https://cbds-dev.ohsu.edu` and open dev tools. Look for a Request header in one of the requests like `user` or `authz` that has the `Cookie` field all filled out. It should be like 10 lines long with multiple parts to it.

5. Open packages/sampleCommons/src/middleware.ts and paste this raw token into the specified header set function. some of the token value seperators are left so that you know wether you have the right token or not.

6. If everything is working you should be 'logged in' to the remote instance on your local frontend for 1 day and all data / auth requests should be getting forwarded to that remote instance.
