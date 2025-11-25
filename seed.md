# We are building a social media application called ruwt (ruwt.social)

## Product Spec
* Based on the scripture in 2 Chronicles 30 where King and Priest Hezekiah makes extensive use of *couriers*, literally *runners* to send messages to all of Israel, telling them to return to the love of God. The Hebrew word for runners or couriers is ratzim, which comes from the root word ruts, pronounced ruwts, which means to run.

* In the physical world we have the concept of a courier or messenger, but we do not really have the same concept in the virtual world. A courier spreads a message throughout a wide space but from human to human in a personalized way. Ruwt therefore aims to bring this way of human interaction to the digital world. It is DM only but you don't interact with the sender directly only with the runner. The sender and receiver do not see each other but the runner sees them both. The runner can reveal the identity of the sender and receiver to each other if they both wish but otherwise only the runner knows the sender and the receiver.

* Ruwt also has the concept of a city. A city is a collection of humans who share common interests. They know each other's identity and can contact each other one on one without the runner as an intermediary.
    - Humans outside of a city can see that a city exists and see its size. They can enter a city unless it's owner has dictated otherwise

* To mimic the real life dynamic of one to many communication where the speaker and the listeners can see each other's identity without the aid of an intermediary, we have the concept of a enclosed space, which we can call a close for short. It is similar to a home whose primary purpose is social. 
    - It is owned by a human, who has all administrative rights and the right to share those rights with others who are present. 
    - Its maximum size is 100
    - It is invite only
    - The right to invite is held by the owner and if the owner chooses can be shared with others who are present while they are present
    - It's existence cannot be confirmed by runners or humans who are not present
    - Humans who share a city can invite each other to a close directly but cannot invite humans they do not share a city with except by sending a runner to spread an invite

* Like a fish in water we have been living in the world of runners without defining fully what they are.

* A runner is digital helper.
    - It has a name
    - It can serve as a medium for dialogue
    - It can modify a message's syntax before delivering to humans who speak a different language than the sender or have a different communication style than the sender
    - It has a strong sense of its identity and role
    - It has access to previous iteractions between itself and a human
    - It computes properties of a human in real time such as their communicaton style, their personality type, their loves based on this log of messages
    - It can respond directly to prompts by a human
    - They have different personalities and behave differently
    - It can notify humans if they send very similar messages and ask them if they want to dialogue or link
    - Some runners with added prestige will require payment to use them, and will sacrifice the payment to the platform by burning it.

* A human is a biological, psychological, and spiritual entity
    - It has a name
    - It has biological, psychological and spiritual characteristics
    - it can send messages directly to humans it knows and to humans it does not know by cities or by the discretion of the runner
    - It can request help from other humans
    - It can request help from runners

## Technologies
* React Native
* Hono
* Bun
* Postgres
* pgvector
* Fly.io
* Supabase


