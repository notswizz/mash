export const config = {
  api: {
    bodyParser: {
      sizeLimit: '50mb',
    },
    responseLimit: false,
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { referenceImages, prompt } = req.body;

  if (!referenceImages || referenceImages.length === 0) {
    return res.status(400).json({ error: 'At least one reference image is required' });
  }

  if (!prompt) {
    return res.status(400).json({ error: 'Prompt is required' });
  }

  const apiKey = process.env.REPLICATE_API_TOKEN;
  if (!apiKey) {
    return res.status(500).json({ error: 'REPLICATE_API_TOKEN not configured in .env.local' });
  }

  try {
    // Use ByteDance Seedream 4.0 with correct parameters
    // https://replicate.com/bytedance/seedream-4
    const response = await fetch('https://api.replicate.com/v1/models/bytedance/seedream-4/predictions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        input: {
          // Array of reference images
          image_input: referenceImages,
          // The prompt describes what to generate/edit
          prompt: prompt,
          // Output settings
          size: "2K",
          width: 2048,
          height: 2048,
          max_images: 1,
          aspect_ratio: "1:1",
          enhance_prompt: true,
          sequential_image_generation: "disabled",
        },
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.log('Seedream 4 error:', errorData);
      
      // Check for rate limiting - auto retry after wait
      if (response.status === 429) {
        const parsed = JSON.parse(errorData);
        const waitTime = (parsed.retry_after || 3) + 1;
        
        console.log(`Rate limited, waiting ${waitTime}s and retrying...`);
        await new Promise(resolve => setTimeout(resolve, waitTime * 1000));
        
        // Retry the request
        const retryResponse = await fetch('https://api.replicate.com/v1/models/bytedance/seedream-4/predictions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            input: {
              image_input: referenceImages,
              prompt: prompt,
              size: "2K",
              width: 2048,
              height: 2048,
              max_images: 1,
              aspect_ratio: "1:1",
              enhance_prompt: true,
              sequential_image_generation: "disabled",
            },
          }),
        });

        if (!retryResponse.ok) {
          const retryError = await retryResponse.text();
          console.log('Retry also failed:', retryError);
          return res.status(429).json({
            error: 'Rate limited - add $5+ credit to Replicate',
            details: 'Free tier has strict limits. Add credit at replicate.com/account/billing',
          });
        }

        const retryPrediction = await retryResponse.json();
        const retryResult = await pollPrediction(retryPrediction, apiKey);
        
        if (retryResult.status === 'succeeded') {
          const outputUrl = Array.isArray(retryResult.output) ? retryResult.output[0] : retryResult.output;
          return res.status(200).json({
            success: true,
            image: outputUrl,
            model: 'bytedance/seedream-4',
          });
        }
      }

      return res.status(response.status).json({
        error: 'Seedream 4 API error',
        details: errorData,
      });
    }

    // Poll for result
    const prediction = await response.json();
    const result = await pollPrediction(prediction, apiKey);
    
    if (result.status === 'succeeded') {
      const outputUrl = Array.isArray(result.output) ? result.output[0] : result.output;
      return res.status(200).json({
        success: true,
        image: outputUrl,
        model: 'bytedance/seedream-4',
      });
    } else {
      return res.status(500).json({
        error: 'Image generation failed',
        details: result.error,
      });
    }

  } catch (error) {
    console.error('Generation error:', error);
    return res.status(500).json({ 
      error: 'Failed to generate image',
      details: error.message 
    });
  }
}

async function pollPrediction(prediction, apiKey) {
  let result = prediction;
  let attempts = 0;
  const maxAttempts = 180; // 3 minutes max
  
  while (
    result.status !== 'succeeded' && 
    result.status !== 'failed' && 
    result.status !== 'canceled' && 
    attempts < maxAttempts
  ) {
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const pollUrl = result.urls?.get || `https://api.replicate.com/v1/predictions/${prediction.id}`;
    const pollResponse = await fetch(pollUrl, {
      headers: { 'Authorization': `Bearer ${apiKey}` },
    });
    
    if (!pollResponse.ok) {
      throw new Error('Failed to poll prediction');
    }
    
    result = await pollResponse.json();
    attempts++;
  }
  
  return result;
}
