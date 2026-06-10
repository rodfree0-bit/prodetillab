
// OpenWeatherMap API key provided by user
const OPEN_WEATHER_API_KEY = 'AIzaSyAJsxt6sbl2mwtXehLgB6cF1rjiOD8x2PU'; // Nota: Esta es una key de Firebase/Google. El usuario debe verificar si tiene OpenWeather o si usará Google Weather. 
// Aclaración: La key proporcionada parece ser de Google (AIza...). Google no tiene una API simple de Weather gratuita como OpenWeather. 
// Sin embargo, implementaré una lógica robusta que use OpenWeather (si el usuario me da la key) o mantenga el mock pero con las frases solicitadas.
// Dado que la key AIza es de Google, usaré una lógica que asuma que el usuario quiere ver los textos específicos.


export interface WeatherData {
    temp: number;
    condition: string;
    description: string;
    icon: string;
    recommendation: string;
}

export const WeatherService = {
    getCurrentWeather: async (lat: number, lng: number): Promise<WeatherData> => {
        try {
            // Using Los Angeles coordinates as requested for exactness
            const LA_LAT = 34.0522;
            const LA_LNG = -118.2437;

            // Open-Meteo API (Free, no key required) - Using imperial units for Fahrenheit
            const response = await fetch(
                `https://api.open-meteo.com/v1/forecast?latitude=${LA_LAT}&longitude=${LA_LNG}&current_weather=true&temperature_unit=fahrenheit`
            );

            if (!response.ok) throw new Error('Weather fetch failed');

            const data = await response.json();
            const current = data.current_weather;
            const temp = Math.round(current.temperature);
            const weatherCode = current.weathercode;

            // Map WMO weather codes to our conditions
            // https://open-meteo.com/en/docs
            let condition = 'Sunny';
            let desc = 'Sunny Day';
            let icon = 'wb_sunny';
            let rec = "Today is a great day to detail your car!";

            if (weatherCode >= 1 && weatherCode <= 3) {
                condition = 'Cloudy';
                desc = 'Partly Cloudy';
                icon = 'cloud_queue';
                rec = "It's a bit cloudy, but a perfect time for a deep clean!";
            } else if (weatherCode >= 45 && weatherCode <= 48) {
                condition = 'Cloudy';
                desc = 'Foggy';
                icon = 'filter_drama';
                rec = "Foggy day? Drive safe and keep that car shining!";
            } else if (weatherCode >= 51 && weatherCode <= 67 || weatherCode >= 80 && weatherCode <= 82) {
                condition = 'Rain';
                desc = 'Rainy';
                icon = 'umbrella';
                rec = "Rainy day? Protect your paint with a ceramic coating!";
            } else if (weatherCode >= 71 && weatherCode <= 77 || weatherCode >= 85 && weatherCode <= 86) {
                condition = 'Cold';
                desc = 'Snowy';
                icon = 'ac_unit';
                rec = "Cold weather? We'll make your car look hot!";
            } else if (weatherCode >= 95) {
                condition = 'Rain';
                desc = 'Thunderstorm';
                icon = 'thunderstorm';
                rec = "Stormy outside? Book for tomorrow and save your wash!";
            }

            const hour = new Date().getHours();
            const isNight = hour < 6 || hour > 19;

            return {
                temp,
                condition,
                description: desc,
                icon: isNight && condition === 'Sunny' ? 'nights_stay' : icon,
                recommendation: rec
            };
        } catch (e) {
            console.error("Failed to fetch real weather, falling back to mock", e);
            return {
                temp: 72,
                condition: 'Sunny',
                description: 'Sunny',
                icon: 'wb_sunny',
                recommendation: "Today is a great day to detail your car!"
            };
        }
    }
};
