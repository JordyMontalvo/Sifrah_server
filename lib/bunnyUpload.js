import https from "https";

const folderMapping = {
  perfil: "perfiles",
  photos: "perfiles",
  audios: "audios",
  product: "productos",
  banner: "banners",
  flyer: "flyers",
  rank_image: "rank_images",
  activation_banner: "activation_banners",
  affiliation_banner: "affiliation_banners",
  promo: "promos",
  "promo-affiliation": "promo_affiliations",
  materials: "materials",
  books: "books",
  books_pdf: "books_pdf",
};

export function uploadToBunny({ fileName, dir = "general", fileData }) {
  if (!fileName || !fileData) {
    return Promise.reject(new Error("Faltan fileName o fileData"));
  }

  const buffer = Buffer.from(fileData, "base64");
  const storageZoneName = process.env.BUNNY_STORAGE_ZONE_NAME;
  const storagePassword = process.env.BUNNY_STORAGE_PASSWORD;
  const storageHostname =
    process.env.BUNNY_STORAGE_HOSTNAME || "br.storage.bunnycdn.com";
  const pullZoneUrl = (
    process.env.BUNNY_PULL_ZONE_URL || "https://sifraht.b-cdn.net"
  ).replace(/\/$/, "");

  if (!storageZoneName || !storagePassword) {
    return Promise.reject(new Error("Credenciales Bunny no configuradas"));
  }

  const targetFolder = folderMapping[dir] || dir;
  const path = `${targetFolder}/${fileName}`;
  const bunnyUrl = `https://${storageHostname}/${storageZoneName}/${path}`;

  return new Promise((resolve, reject) => {
    const bunnyReq = https.request(
      bunnyUrl,
      {
        method: "PUT",
        headers: {
          AccessKey: storagePassword,
          "Content-Type": "application/octet-stream",
          "Content-Length": buffer.length,
        },
      },
      (bunnyRes) => {
        let responseData = "";
        bunnyRes.on("data", (d) => {
          responseData += d;
        });
        bunnyRes.on("end", () => {
          if (bunnyRes.statusCode === 201 || bunnyRes.statusCode === 200) {
            resolve({ url: `${pullZoneUrl}/${path}` });
            return;
          }
          reject(
            new Error(
              `Bunny error ${bunnyRes.statusCode}: ${responseData || "sin detalle"}`
            )
          );
        });
      }
    );

    bunnyReq.on("error", (e) => {
      reject(new Error(`Network error: ${e.message}`));
    });

    bunnyReq.write(buffer);
    bunnyReq.end();
  });
}
