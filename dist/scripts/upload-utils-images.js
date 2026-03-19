"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_s3_1 = require("@aws-sdk/client-s3");
const dotenv = require("dotenv");
const path = require("path");
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });
const s3 = new client_s3_1.S3Client({
    endpoint: process.env.S3_ENDPOINT,
    region: process.env.S3_REGION || 'us-east-1',
    credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY,
        secretAccessKey: process.env.S3_SECRET_KEY,
    },
    forcePathStyle: true,
});
const BUCKET = process.env.S3_BUCKET_NAME || 'ai-generations';
const images = {
    'character-type': [
        { name: 'human', url: 'https://cdn.higgsfield.ai/ai_influencer_option/977e0927-1320-426b-9de3-e3a3434dbe7a.webp' },
        { name: 'ant', url: 'https://cdn.higgsfield.ai/ai_influencer_option/d950aa8c-7f58-4277-9f7c-a4c0f073ae99.webp' },
        { name: 'bee', url: 'https://cdn.higgsfield.ai/ai_influencer_option/20b90c9f-d11f-4816-ad7d-f7f388a5a8b0.webp' },
        { name: 'octopus', url: 'https://cdn.higgsfield.ai/ai_influencer_option/cf21cfdb-7f25-49b2-8554-2192046aac83.webp' },
        { name: 'crocodile', url: 'https://cdn.higgsfield.ai/ai_influencer_option/79073855-12ba-4339-85ce-dc99ecf4d14c.webp' },
        { name: 'iguana', url: 'https://cdn.higgsfield.ai/ai_influencer_option/5c237648-205d-484d-80e6-baa1c71d9b17.webp' },
        { name: 'lizard', url: 'https://cdn.higgsfield.ai/ai_influencer_option/039958ce-ec7c-465f-a285-935802b2525d.webp' },
        { name: 'alien', url: 'https://cdn.higgsfield.ai/ai_influencer_option/077efffe-f459-4dd2-a5a7-064caeca5c10.webp' },
        { name: 'beetle', url: 'https://cdn.higgsfield.ai/ai_influencer_option/704f1cb5-f833-4758-9f99-ba9fe6e2ed53.webp' },
        { name: 'reptile', url: 'https://cdn.higgsfield.ai/ai_influencer_option/cd38cb79-b638-43f3-b546-d31849b6fe05.webp' },
        { name: 'amphibian', url: 'https://cdn.higgsfield.ai/ai_influencer_option/d0667019-3b2f-41f6-a09c-5461a5c5b7e0.webp' },
        { name: 'elf', url: 'https://cdn.higgsfield.ai/ai_influencer_option/f5e66aec-8b11-48b0-904b-6c84eb07349e.webp' },
        { name: 'mantis', url: 'https://cdn.higgsfield.ai/ai_influencer_option/feb723e6-fed4-4e6b-965d-38f50ac4f8d6.webp' },
    ],
    'gender': [
        { name: 'female', url: 'https://cdn.higgsfield.ai/ai_influencer_option/f9fa514b-620d-433e-bd4e-eadd880de118.webp' },
        { name: 'male', url: 'https://cdn.higgsfield.ai/ai_influencer_option/fb91b108-27fc-4e7c-a8fd-876dc8c30ecf.webp' },
        { name: 'trans-man', url: 'https://cdn.higgsfield.ai/ai_influencer_option/95002c8f-c0d6-4dec-8cac-fc7b50501600.webp' },
        { name: 'trans-woman', url: 'https://cdn.higgsfield.ai/ai_influencer_option/21fc9f46-6f1f-4aed-8f74-0ca3080c8eec.webp' },
        { name: 'non-binary', url: 'https://cdn.higgsfield.ai/ai_influencer_option/58a652a4-bf5e-43ca-95a8-8f9e9cef5b6b.webp' },
    ],
    'ethnicity': [
        { name: 'african', url: 'https://cdn.higgsfield.ai/ai_influencer_option/22d1da5f-5581-4030-9a14-c8dc61c40abc.webp' },
        { name: 'asian', url: 'https://cdn.higgsfield.ai/ai_influencer_option/c6693caf-8a31-44c6-b9c1-120b44b940a0.webp' },
        { name: 'european', url: 'https://cdn.higgsfield.ai/ai_influencer_option/b92e05ee-79a1-4c22-ba32-400c17eb9df3.webp' },
        { name: 'indian', url: 'https://cdn.higgsfield.ai/ai_influencer_option/35cff943-7efb-40cd-a168-dbb1f7cdbebb.webp' },
        { name: 'middle-eastern', url: 'https://cdn.higgsfield.ai/ai_influencer_option/0f49e0cd-7b30-4bb3-94c5-792d684a4492.webp' },
        { name: 'mixed', url: 'https://cdn.higgsfield.ai/ai_influencer_option/a992a191-6c13-46e2-991d-f5219b1f5f09.webp' },
    ],
    'skin-color': [
        { name: 'mixed-colors', url: 'https://cdn.higgsfield.ai/ai_influencer_option/4f7118d2-a16f-4cd3-8760-9a44d301baa3.webp' },
    ],
    'eye-color': [
        { name: 'black', url: 'https://cdn.higgsfield.ai/ai_influencer_option/cc87aaa5-568e-4485-ad17-925378e14040.webp' },
        { name: 'purple', url: 'https://cdn.higgsfield.ai/ai_influencer_option/6cb9d132-30d8-4325-83f5-10e8094e85a7.webp' },
        { name: 'green', url: 'https://cdn.higgsfield.ai/ai_influencer_option/dba6cbbb-557a-4d71-b5ab-720b5791282c.webp' },
        { name: 'white', url: 'https://cdn.higgsfield.ai/ai_influencer_option/e6c522cd-c482-44d5-b0fd-d938ac3cdc4e.webp' },
        { name: 'brown', url: 'https://cdn.higgsfield.ai/ai_influencer_option/67ef9f67-0c21-4d78-8044-561792277b4f.webp' },
        { name: 'black-solid-void', url: 'https://cdn.higgsfield.ai/ai_influencer_option/5cbd08f7-8c6a-48c4-aa93-d796fe97b8ec.webp' },
        { name: 'white-blind-empty', url: 'https://cdn.higgsfield.ai/ai_influencer_option/72969f70-ed33-4f69-ae34-61df12f24dda.webp' },
        { name: 'deep-brown', url: 'https://cdn.higgsfield.ai/ai_influencer_option/3bc13ca9-defe-4fea-a473-2a6e17cbc521.webp' },
        { name: 'blue', url: 'https://cdn.higgsfield.ai/ai_influencer_option/15e8f960-c44b-43ae-aafb-4fd79556c420.webp' },
        { name: 'amber', url: 'https://cdn.higgsfield.ai/ai_influencer_option/4fa90e64-f060-4407-9d1f-ed8b23723c46.webp' },
        { name: 'red', url: 'https://cdn.higgsfield.ai/ai_influencer_option/0f422982-0f63-460e-a459-2a2fd48f6ee0.webp' },
        { name: 'grey', url: 'https://cdn.higgsfield.ai/ai_influencer_option/cdfa6a1f-c914-44c9-afea-0a0771feeb54.webp' },
    ],
    'skin-conditions': [
        { name: 'vitiligo', url: 'https://cdn.higgsfield.ai/ai_influencer_option/bf0f7520-a41a-46b9-b41c-7dc030c22b8b.webp' },
        { name: 'pigmentation', url: 'https://cdn.higgsfield.ai/ai_influencer_option/a9e6b3c8-9ab5-4fe3-8b99-5c5fbfa9665c.webp' },
        { name: 'freckles', url: 'https://cdn.higgsfield.ai/ai_influencer_option/a657e9c1-02b6-4083-a058-5f78e56a77ac.webp' },
        { name: 'birthmarks', url: 'https://cdn.higgsfield.ai/ai_influencer_option/4210a458-66a4-4850-a0ec-5ae20f2214e8.webp' },
        { name: 'scars', url: 'https://cdn.higgsfield.ai/ai_influencer_option/9d28dcde-2709-4fa8-8f61-8a76798b0e1f.webp' },
        { name: 'burns', url: 'https://cdn.higgsfield.ai/ai_influencer_option/427cee67-8074-4640-ba06-51e4a5bf7ee3.webp' },
        { name: 'albinism', url: 'https://cdn.higgsfield.ai/ai_influencer_option/6069e93f-31ce-4840-8e48-c81daee56be0.webp' },
        { name: 'cracked-dry-skin', url: 'https://cdn.higgsfield.ai/ai_influencer_option/e0fd17ab-f4bd-4950-9fdf-691a98b021c3.webp' },
        { name: 'wrinkled-skin', url: 'https://cdn.higgsfield.ai/ai_influencer_option/26f07d76-57a7-4975-b18b-80a5fa2137c5.webp' },
    ],
    'advanced-categories': [
        { name: 'face', url: 'https://cdn.higgsfield.ai/ai_influencer_parent_category/e0805c7f-c1b0-4c68-bbc7-bab5ae86d6df.webp' },
        { name: 'body', url: 'https://cdn.higgsfield.ai/ai_influencer_parent_category/ee30f691-5d7b-4788-af82-73d86b6f32bb.webp' },
        { name: 'style', url: 'https://cdn.higgsfield.ai/ai_influencer_parent_category/5b67892f-ef65-4f8d-af20-e0f35a13f1b3.webp' },
    ],
    'eyes-type': [
        { name: 'human', url: 'https://cdn.higgsfield.ai/ai_influencer_option/ce3bb1ff-d120-4539-8aea-51bacb9e96f9.webp' },
        { name: 'reptile', url: 'https://cdn.higgsfield.ai/ai_influencer_option/76b1c85d-dba3-43d6-b6b0-27f2923bdab8.webp' },
        { name: 'mechanical', url: 'https://cdn.higgsfield.ai/ai_influencer_option/6d7dfd84-741d-4757-9bab-a3ff7cb28612.webp' },
    ],
    'eyes-details': [
        { name: 'different-eye-colors', url: 'https://cdn.higgsfield.ai/ai_influencer_option/199bb0e7-41e8-40af-aae7-77c0c659b260.webp' },
        { name: 'blind-eye', url: 'https://cdn.higgsfield.ai/ai_influencer_option/a1b256a6-45a1-4008-adff-fb0fa1b52c30.webp' },
        { name: 'scarred-eye', url: 'https://cdn.higgsfield.ai/ai_influencer_option/25f40e63-e0b8-4470-aac8-b3b00465f0ac.webp' },
        { name: 'glowing-eye', url: 'https://cdn.higgsfield.ai/ai_influencer_option/a6a19585-e8ae-4b5b-8334-f0f24248735d.webp' },
    ],
    'mouth-teeth': [
        { name: 'small-mouth', url: 'https://cdn.higgsfield.ai/ai_influencer_option/739d39d2-acc7-44b5-82e9-4d3c7bd8a1cc.webp' },
        { name: 'large-mouth', url: 'https://cdn.higgsfield.ai/ai_influencer_option/1baa22a5-87fe-49ce-8094-a35669ae367a.webp' },
        { name: 'no-teeth', url: 'https://cdn.higgsfield.ai/ai_influencer_option/dad0081e-4011-4420-9a95-6a9b96e5c8d9.webp' },
        { name: 'different-teeth', url: 'https://cdn.higgsfield.ai/ai_influencer_option/517e33c9-82ff-4de3-9d38-8205b26e0985.webp' },
        { name: 'sharp-teeth', url: 'https://cdn.higgsfield.ai/ai_influencer_option/d44ff654-3b53-4f44-bf54-1c8d0d5c4291.webp' },
        { name: 'forked-tongue', url: 'https://cdn.higgsfield.ai/ai_influencer_option/adb9bb83-1db6-41cc-9933-bae88b72739d.webp' },
        { name: 'two-tongues', url: 'https://cdn.higgsfield.ai/ai_influencer_option/43aeb851-4c2e-4c3b-b556-21b425eefc75.webp' },
    ],
    'ears': [
        { name: 'human', url: 'https://cdn.higgsfield.ai/ai_influencer_option/d7a9fd58-5eb3-4e3f-ad56-67bbf3655463.webp' },
        { name: 'elf', url: 'https://cdn.higgsfield.ai/ai_influencer_option/e9b3d421-6cfb-41f9-af4a-fc3649238b91.webp' },
        { name: 'no-ears', url: 'https://cdn.higgsfield.ai/ai_influencer_option/562abb29-5f61-4485-83e5-470797a8e591.webp' },
        { name: 'wing-ears', url: 'https://cdn.higgsfield.ai/ai_influencer_option/9e2c4603-d683-427a-80c0-18332a0f564b.webp' },
    ],
    'horns': [
        { name: 'small-horns', url: 'https://cdn.higgsfield.ai/ai_influencer_option/9664d380-e818-418e-a42d-f5bf4f1dc19a.webp' },
        { name: 'big-horns', url: 'https://cdn.higgsfield.ai/ai_influencer_option/4a4792eb-215a-4d78-b294-3f0e6bd54c04.webp' },
        { name: 'antlers', url: 'https://cdn.higgsfield.ai/ai_influencer_option/a7c647b3-c37b-4ecb-a61f-52442e1cad89.webp' },
    ],
    'face-skin-material': [
        { name: 'human-skin', url: 'https://cdn.higgsfield.ai/ai_influencer_option/34d672df-7b82-4b08-b298-4e484ee2d8a2.webp' },
        { name: 'scales', url: 'https://cdn.higgsfield.ai/ai_influencer_option/dfb106df-8549-4758-a9fe-d405f956dc13.webp' },
        { name: 'fur', url: 'https://cdn.higgsfield.ai/ai_influencer_option/b041790f-27b1-491e-900a-df7b44b0c0c3.webp' },
        { name: 'amphibian-skin', url: 'https://cdn.higgsfield.ai/ai_influencer_option/e471f0b4-7a41-4999-bc8d-9f9f6e030e4c.webp' },
        { name: 'fish-skin', url: 'https://cdn.higgsfield.ai/ai_influencer_option/a349307d-dad9-4e4d-98ec-cd84094067a7.webp' },
        { name: 'metallic', url: 'https://cdn.higgsfield.ai/ai_influencer_option/cde0fbeb-0556-4881-9e9e-1d4c5a5cf067.webp' },
    ],
    'surface-pattern': [
        { name: 'solid', url: 'https://cdn.higgsfield.ai/ai_influencer_option/9d344ce6-aecf-4d44-9969-485a6cdbb4c1.webp' },
        { name: 'stripes', url: 'https://cdn.higgsfield.ai/ai_influencer_option/979e4934-dbef-4fbe-be38-f3579f2cc78e.webp' },
        { name: 'spots', url: 'https://cdn.higgsfield.ai/ai_influencer_option/7b92c3aa-b271-4e8b-b5ee-331ec8fc3da7.webp' },
        { name: 'chess-pattern', url: 'https://cdn.higgsfield.ai/ai_influencer_option/b956ae69-56df-40a3-baf9-f879ce1292f1.webp' },
        { name: 'veins-visible', url: 'https://cdn.higgsfield.ai/ai_influencer_option/14aa0526-5be3-4a2b-a172-3c6af54b4d36.webp' },
        { name: 'giraffe-pattern', url: 'https://cdn.higgsfield.ai/ai_influencer_option/e45c30a6-8b55-40df-a85c-ba06a86273af.webp' },
        { name: 'cowhide-pattern', url: 'https://cdn.higgsfield.ai/ai_influencer_option/0fd77971-2a7f-45f2-af99-1db26bf6339e.webp' },
    ],
};
async function downloadImage(url) {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to download ${url}: ${response.status}`);
    }
    return Buffer.from(await response.arrayBuffer());
}
async function uploadToS3(key, body) {
    await s3.send(new client_s3_1.PutObjectCommand({
        Bucket: BUCKET,
        Key: key,
        Body: body,
        ContentType: 'image/webp',
    }));
}
async function main() {
    let total = 0;
    let success = 0;
    let failed = 0;
    for (const [category, entries] of Object.entries(images)) {
        total += entries.length;
    }
    console.log(`Starting upload of ${total} images to s3://${BUCKET}/utils/\n`);
    for (const [category, entries] of Object.entries(images)) {
        console.log(`\n--- ${category} (${entries.length} images) ---`);
        for (const entry of entries) {
            const s3Key = `utils/${category}/${entry.name}.webp`;
            try {
                process.stdout.write(`  Downloading ${entry.name}...`);
                const buffer = await downloadImage(entry.url);
                process.stdout.write(` ${(buffer.length / 1024).toFixed(1)}KB`);
                process.stdout.write(` -> Uploading to ${s3Key}...`);
                await uploadToS3(s3Key, buffer);
                console.log(' OK');
                success++;
            }
            catch (error) {
                console.log(` FAILED: ${error.message}`);
                failed++;
            }
        }
    }
    console.log(`\n========================================`);
    console.log(`Done! ${success}/${total} uploaded, ${failed} failed.`);
}
main().catch(console.error);
//# sourceMappingURL=upload-utils-images.js.map