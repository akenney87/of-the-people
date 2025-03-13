// File: src/pages/About.jsx
import ResponsiveContainer from '../components/ResponsiveContainer';

export default function About() {
  return (
    <div className="bg-background font-sf min-h-screen w-full pt-20 pb-10">
      <ResponsiveContainer>
        <div className="bg-background p-xl rounded-lg shadow-lg w-full text-text-primary text-center">
          <h2 className="text-3xl font-bold mb-xl">About Of the People</h2>
          <p className="text-sm md:text-base lg:text-lg">
            Of the People is a platform dedicated to empowering citizens to engage with their representatives and participate in the democratic process.
          </p>
        </div>
      </ResponsiveContainer>
    </div>
  );
}