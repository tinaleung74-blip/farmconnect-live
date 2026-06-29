FarmConnect Rooster Image Assets

Copy this folder into your Next.js public folder so the final path is:
public/farmconnect/roosters/

Use these routes in code:
/farmconnect/roosters/fc-rooster-hero.jpg
/farmconnect/roosters/fc-stage-1-chick-base.jpg
/farmconnect/roosters/fc-stage-2-grower-base.jpg
/farmconnect/roosters/fc-stage-3-young-rooster-base.jpg
/farmconnect/roosters/fc-stage-4-adult-rooster-base.jpg

Display priority:
1. Latest caretaker/customer uploaded animal photo
2. animals.image_url
3. Stage base image from this folder

Stage rules:
Day 1-14   -> fc-stage-1-chick-base.jpg
Day 15-28  -> fc-stage-2-grower-base.jpg
Day 29-60  -> fc-stage-3-young-rooster-base.jpg
Day 60+    -> fc-stage-4-adult-rooster-base.jpg

When a stage base image is shown, display a "Base photo" badge so the customer knows it will be replaced by real caretaker photo updates.
