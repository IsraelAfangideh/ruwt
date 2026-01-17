In [Link text](./12_06_25_12_15_add_mobile.md) we added mobile to the app. But its still purely in development. We need to setup the deployment system.

Whenever we push to main, the application should auto deploy. Both the backend and the frontend depending on where changes were made. Any database changes should be deployed as well. We do not currently have hosting contracts anywhere we need advice and research to figure out which ones to use based on the product spec. 
The end result should be that when code is pushed to main, it is automatically shown in the application and the correct backend version is being hit. Ideally we don't even need to test locally we can just auto test after deployment in the app itself. 

After this ispec is complete, we will go back to improving UX on mobile and then get more users and then we will add The Mediator as a runner.

## Future Architecture: Media Handling
*Added on Dec 8, 2025*

As we move beyond text-only messages, we will leverage **Supabase Vector Buckets** to handle multimodal context (images, audio).
- **Mechanism:** Mobile uploads media directly to Supabase Storage.
- **Automation:** Storage triggers automatically generate embeddings (using Transformers.js or compatible models) and store them in `pgvector`.
- **Benefit:** Reduces API complexity and keeps heavy processing asynchronous ("Latency as a Feature").
