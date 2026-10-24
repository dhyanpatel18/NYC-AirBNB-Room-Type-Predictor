from fastapi import FastAPI 
import pandas as pd
from pydantic import BaseModel, Field
import joblib
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Room type predictor")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"]
)

COLUMNS = ['latitude', 'longitude', 'price', 
           'minimum_nights', 'number_of_reviews', 'reviews_per_month',
           'calculated_host_listings_count', 'availability_365', 
           'neighbourhood_group', 'neighbourhood']

model = joblib.load("Model_pipeline.pkl")

#pydantic model  = input data validation
class Features(BaseModel):
    latitude: float = Field(..., ge=-90, le=90, description="Latitude must be between -90 and 90")
    longitude: float = Field(..., ge=-180, le=180, description="Longitude must be between -180 and 180")
    price: float = Field(..., gt =0, description="Price per night, must be positive")
    minimum_nights: int = Field(..., ge=1, description="Minimum nights required for booking")
    number_of_reviews: int = Field(..., ge = 0, description="Total number of reviews")
    reviews_per_month: float = Field(...,ge=0, description="Number of reviews per month")
    calculated_host_listings_count: int = Field(..., ge=0, description="Total number of listings by the host")
    availability_365: int = Field(..., ge=0, le=365, description="Number of days the listing is available in a year")
    neighbourhood_group: str = Field(...,min_length=1, description="Neighbourhood group of the listing")
    neighbourhood: str = Field(...,min_length=1, description="Neighbourhood of the listing")



@app.get("/")
def health():
    return {"status": "ok"}

@app.post("/predict")
def predict(features: Features):
    row = pd.DataFrame([features.dict()], columns=COLUMNS, index=[0])
    prediction = model.predict(row)
    probability = model.predict_proba(row)
    
    return {
        "Predicted_room_type": prediction[0],
        "Probability": probability.tolist()
    }












